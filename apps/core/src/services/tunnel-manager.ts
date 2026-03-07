/**
 * Cloudflare Tunnel manager.
 * Manages the lifecycle of a `cloudflared` process to expose the Core
 * WebSocket server to the internet without port forwarding.
 *
 * Supports two modes:
 * - Quick tunnel: temporary URL, no Cloudflare account needed
 * - Named tunnel: persistent URL, requires a tunnel token from Cloudflare dashboard
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, createWriteStream, unlinkSync } from 'node:fs';
import { mkdir, chmod } from 'node:fs/promises';
import type { EventEmitter } from 'node:events';
import { homedir, platform, arch } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export type TunnelMode = 'quick' | 'named';

export interface TunnelStatus {
  running: boolean;
  url: string | null;
  mode: TunnelMode;
  cloudflaredInstalled: boolean;
  error: string | null;
}

export class TunnelManager {
  private process: ChildProcess | null = null;
  private tunnelUrl: string | null = null;
  private mode: TunnelMode = 'quick';
  private running = false;
  private error: string | null = null;

  constructor(
    private emitter: EventEmitter,
    private localPort: number,
  ) {}

  /** Check if cloudflared binary is available (PATH or local install). */
  async isInstalled(): Promise<boolean> {
    const localPath = this.getLocalBinaryPath();
    if (existsSync(localPath)) return true;

    return new Promise((resolve) => {
      const proc = spawn('cloudflared', ['version'], { stdio: 'pipe' });
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /** Download cloudflared binary from GitHub releases. */
  async install(): Promise<{ success: boolean; message: string }> {
    const plat = platform();
    const cpuArch = arch();

    const archMap: Record<string, string> = { x64: 'amd64', arm64: 'arm64', ia32: '386' };
    const cfArch = archMap[cpuArch];
    if (!cfArch) {
      return { success: false, message: `Unsupported architecture: ${cpuArch}` };
    }

    const osMap: Record<string, string> = { win32: 'windows', linux: 'linux', darwin: 'darwin' };
    const cfOs = osMap[plat];
    if (!cfOs) {
      return { success: false, message: `Unsupported platform: ${plat}` };
    }

    const binDir = join(homedir(), '.nexuscore', 'bin');
    await mkdir(binDir, { recursive: true });
    const destPath = this.getLocalBinaryPath();

    try {
      if (plat === 'darwin') {
        // macOS: GitHub releases are .tgz archives
        const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-${cfArch}.tgz`;
        const tgzPath = join(binDir, 'cloudflared.tgz');

        console.log(`[Tunnel] Downloading cloudflared from GitHub...`);
        await this.downloadFile(url, tgzPath);

        // Extract using system tar
        await new Promise<void>((resolve, reject) => {
          const tar = spawn('tar', ['-xzf', tgzPath, '-C', binDir]);
          tar.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`tar exited with ${code}`))));
          tar.on('error', reject);
        });
        try { unlinkSync(tgzPath); } catch { /* ignore */ }
        await chmod(destPath, 0o755);
      } else {
        // Windows and Linux: direct binary downloads
        const ext = plat === 'win32' ? '.exe' : '';
        const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${cfOs}-${cfArch}${ext}`;

        console.log(`[Tunnel] Downloading cloudflared from GitHub...`);
        await this.downloadFile(url, destPath);

        if (plat !== 'win32') {
          await chmod(destPath, 0o755);
        }
      }

      console.log(`[Tunnel] cloudflared installed to ${destPath}`);
      return { success: true, message: 'cloudflared installed successfully' };
    } catch (err) {
      return { success: false, message: `Download failed: ${(err as Error).message}` };
    }
  }

  /** Start a quick tunnel (no Cloudflare account needed). Returns the tunnel URL. */
  async startQuick(): Promise<string> {
    if (this.running) throw new Error('Tunnel is already running');

    const installed = await this.isInstalled();
    if (!installed) throw new Error('cloudflared is not installed');

    const cmd = this.getBinaryCommand();
    this.mode = 'quick';
    this.error = null;

    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, ['tunnel', '--url', `http://localhost:${this.localPort}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.process = proc;
      let urlFound = false;

      const timeout = setTimeout(() => {
        if (!urlFound) {
          this.stop();
          reject(new Error('Tunnel startup timed out after 30s'));
        }
      }, 30_000);

      const parseOutput = (data: Buffer) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !urlFound) {
          urlFound = true;
          clearTimeout(timeout);
          this.tunnelUrl = match[0];
          this.running = true;
          console.log(`[Tunnel] Quick tunnel started: ${this.tunnelUrl}`);
          this.emitter.emit('tunnel:started', { url: this.tunnelUrl, mode: 'quick' });
          resolve(this.tunnelUrl);
        }
      };

      proc.stdout?.on('data', parseOutput);
      proc.stderr?.on('data', parseOutput);

      proc.on('error', (err) => {
        clearTimeout(timeout);
        this.running = false;
        this.error = err.message;
        this.emitter.emit('tunnel:error', { error: err.message });
        if (!urlFound) reject(new Error(`Failed to start cloudflared: ${err.message}`));
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        const wasRunning = this.running;
        this.running = false;
        this.process = null;
        this.tunnelUrl = null;
        if (wasRunning) {
          console.log(`[Tunnel] cloudflared exited with code ${code}`);
          this.emitter.emit('tunnel:stopped', { code });
        }
        if (!urlFound) reject(new Error(`cloudflared exited with code ${code}`));
      });
    });
  }

  /** Start a named tunnel with a Cloudflare tunnel token. */
  async startNamed(token: string): Promise<void> {
    if (this.running) throw new Error('Tunnel is already running');
    if (!token) throw new Error('Tunnel token is required for named tunnels');

    const installed = await this.isInstalled();
    if (!installed) throw new Error('cloudflared is not installed');

    const cmd = this.getBinaryCommand();
    this.mode = 'named';
    this.error = null;

    const proc = spawn(cmd, ['tunnel', 'run', '--token', token], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process = proc;
    this.running = true;

    // Try to parse URL from output (named tunnels log their hostname)
    const parseUrl = (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (match && !this.tunnelUrl) {
        this.tunnelUrl = match[0];
        this.emitter.emit('tunnel:urlResolved', { url: this.tunnelUrl });
      }
    };

    proc.stdout?.on('data', parseUrl);
    proc.stderr?.on('data', parseUrl);

    proc.on('error', (err) => {
      this.running = false;
      this.error = err.message;
      this.emitter.emit('tunnel:error', { error: err.message });
    });

    proc.on('close', (code) => {
      this.running = false;
      this.process = null;
      this.tunnelUrl = null;
      console.log(`[Tunnel] Named tunnel exited with code ${code}`);
      this.emitter.emit('tunnel:stopped', { code });
    });

    console.log('[Tunnel] Named tunnel started');
    this.emitter.emit('tunnel:started', { mode: 'named' });
  }

  /** Stop the running tunnel. */
  stop(): void {
    if (!this.process) return;

    if (platform() === 'win32') {
      // Windows: kill the process tree
      spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      this.process.kill('SIGTERM');
      const proc = this.process;
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already dead */ }
      }, 5000);
    }

    this.running = false;
    this.tunnelUrl = null;
    this.process = null;
    this.error = null;
    console.log('[Tunnel] Tunnel stopped');
  }

  /** Get current tunnel status (sync — cloudflaredInstalled is always false, use getFullStatus). */
  getStatus(): TunnelStatus {
    return {
      running: this.running,
      url: this.tunnelUrl,
      mode: this.mode,
      cloudflaredInstalled: false,
      error: this.error,
    };
  }

  /** Get full tunnel status including async cloudflared install check. */
  async getFullStatus(): Promise<TunnelStatus> {
    return {
      ...this.getStatus(),
      cloudflaredInstalled: await this.isInstalled(),
    };
  }

  /** Clean up on shutdown. */
  destroy(): void {
    this.stop();
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private getLocalBinaryPath(): string {
    const binDir = join(homedir(), '.nexuscore', 'bin');
    const ext = platform() === 'win32' ? '.exe' : '';
    return join(binDir, `cloudflared${ext}`);
  }

  private getBinaryCommand(): string {
    const localPath = this.getLocalBinaryPath();
    if (existsSync(localPath)) return localPath;
    return 'cloudflared';
  }

  private async downloadFile(url: string, dest: string): Promise<void> {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const body = response.body;
    if (!body) throw new Error('Empty response body');

    const fileStream = createWriteStream(dest);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await pipeline(Readable.fromWeb(body as any), fileStream);
  }
}
