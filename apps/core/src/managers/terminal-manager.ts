import type { TerminalInfo } from '@nexus-core/protocol';
import { generateId } from '@nexus-core/protocol';
import type { EventEmitter } from 'node:events';

// node-pty types
interface IPty {
  pid: number;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
}

interface NodePtyModule {
  spawn: (
    file: string,
    args: string[],
    options: { name: string; cols: number; rows: number; cwd?: string; env?: Record<string, string> },
  ) => IPty;
}

interface TerminalSession {
  info: TerminalInfo;
  pty: IPty | null;
  disposables: { dispose: () => void }[];
}

/**
 * Creates and manages pseudo-terminal (PTY) sessions per workspace.
 * Streams output to connected clients in real-time.
 */
export class TerminalManager {
  private terminals = new Map<string, TerminalSession>();
  private nodePty: NodePtyModule | null = null;
  private initError: string | null = null;

  constructor(private emitter: EventEmitter) {}

  async init(): Promise<void> {
    try {
      this.nodePty = (await import('node-pty')) as unknown as NodePtyModule;
    } catch {
      this.initError = 'node-pty not available — terminal functionality disabled';
      console.warn(`[TerminalManager] ${this.initError}`);
    }
  }

  createTerminal(workspaceId: string, shell?: string, cols = 80, rows = 24, cwd?: string): TerminalInfo {
    if (!this.nodePty) {
      throw new Error(this.initError ?? 'TerminalManager not initialized');
    }

    const id = generateId('term');
    const resolvedShell =
      shell ?? (process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL ?? '/bin/bash');

    const pty = this.nodePty.spawn(resolvedShell, [], {
      name: 'xterm-256color',
      cols,
      rows,
      ...(cwd ? { cwd } : {}),
    });

    const info: TerminalInfo = {
      id,
      workspaceId,
      shell: resolvedShell,
      cols,
      rows,
      pid: pty.pid,
    };

    const disposables: { dispose: () => void }[] = [];

    disposables.push(
      pty.onData((data: string) => {
        this.emitter.emit('terminal:output', { terminalId: id, data });
      }),
    );

    disposables.push(
      pty.onExit((e: { exitCode: number }) => {
        this.emitter.emit('terminal:exit', { terminalId: id, exitCode: e.exitCode });
        this.terminals.delete(id);
      }),
    );

    this.terminals.set(id, { info, pty, disposables });
    this.emitter.emit('terminal:created', info);
    return info;
  }

  writeToTerminal(terminalId: string, data: string): void {
    const session = this.terminals.get(terminalId);
    if (!session?.pty) throw new Error(`Terminal ${terminalId} not found`);
    session.pty.write(data);
  }

  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    const session = this.terminals.get(terminalId);
    if (!session?.pty) throw new Error(`Terminal ${terminalId} not found`);
    session.pty.resize(cols, rows);
    session.info.cols = cols;
    session.info.rows = rows;
  }

  closeTerminal(terminalId: string): void {
    const session = this.terminals.get(terminalId);
    if (!session) return;
    for (const d of session.disposables) d.dispose();
    session.pty?.kill();
    this.terminals.delete(terminalId);
  }

  listTerminals(workspaceId?: string): TerminalInfo[] {
    const all = Array.from(this.terminals.values()).map((s) => s.info);
    return workspaceId ? all.filter((t) => t.workspaceId === workspaceId) : all;
  }

  closeAll(): void {
    for (const [id] of this.terminals) {
      this.closeTerminal(id);
    }
  }
}
