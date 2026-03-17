import { readFile, writeFile, readdir, stat, mkdir, access, rename, rm, unlink } from 'node:fs/promises';
import { join, basename, relative, resolve } from 'node:path';
import type { FileEntry, FileChange } from '@nexus-core/protocol';
import type { EventEmitter } from 'node:events';

type ChokidarWatcher = { close: () => Promise<void> };
type ChokidarModule = {
  watch: (
    paths: string | string[],
    options?: Record<string, unknown>,
  ) => ChokidarWatcher & {
    on: (event: string, callback: (...args: unknown[]) => void) => unknown;
  };
};

const IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/.next/**',
  '**/.nuxt/**',
];

/**
 * Watches project directories for changes, serves file contents to clients,
 * and handles file edits from both agents and users.
 */
export class FileManager {
  private watchers = new Map<string, ChokidarWatcher>();
  private chokidar: ChokidarModule | null = null;
  private changeHandlers: ((change: FileChange) => void)[] = [];

  constructor(private emitter: EventEmitter) {}

  async init(): Promise<void> {
    try {
      this.chokidar = (await import('chokidar')) as unknown as ChokidarModule;
    } catch {
      console.warn('[FileManager] chokidar not available — file watching disabled');
    }
  }

  async watchDirectory(dirPath: string, workspaceId?: string): Promise<void> {
    if (!this.chokidar) return;
    if (this.watchers.has(dirPath)) return;

    const watcher = this.chokidar.watch(dirPath, {
      ignored: IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('add', (filePath: unknown) => {
      const change: FileChange = { path: String(filePath), type: 'created' };
      this.notifyChange(change, workspaceId);
    });
    watcher.on('addDir', (filePath: unknown) => {
      const change: FileChange = { path: String(filePath), type: 'created' };
      this.notifyChange(change, workspaceId);
    });
    watcher.on('change', (filePath: unknown) => {
      const change: FileChange = { path: String(filePath), type: 'modified' };
      this.notifyChange(change, workspaceId);
    });
    watcher.on('unlink', (filePath: unknown) => {
      const change: FileChange = { path: String(filePath), type: 'deleted' };
      this.notifyChange(change, workspaceId);
    });
    watcher.on('unlinkDir', (filePath: unknown) => {
      const change: FileChange = { path: String(filePath), type: 'deleted' };
      this.notifyChange(change, workspaceId);
    });

    this.watchers.set(dirPath, watcher);
  }

  private notifyChange(change: FileChange, workspaceId?: string): void {
    for (const handler of this.changeHandlers) handler(change);
    this.emitter.emit('file:changed', { ...change, workspaceId: workspaceId ?? '' });
  }

  async readFileContent(filePath: string): Promise<string> {
    return readFile(filePath, 'utf-8');
  }

  async writeFileContent(filePath: string, content: string, createDirs = false): Promise<void> {
    if (createDirs) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dir) await mkdir(dir, { recursive: true });
    }
    await writeFile(filePath, content, 'utf-8');
  }

  /**
   * List available drive letters on Windows.
   * Returns entries like [{ path: 'C:/', name: 'C:', type: 'directory' }, ...].
   */
  async listDrives(): Promise<FileEntry[]> {
    const drives: FileEntry[] = [];
    const checks = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async (letter) => {
      const drivePath = `${letter}:\\`;
      try {
        await access(drivePath);
        drives.push({ path: `${letter}:/`, name: `${letter}:`, type: 'directory' });
      } catch {
        // drive doesn't exist
      }
    });
    await Promise.all(checks);
    drives.sort((a, b) => a.name.localeCompare(b.name));
    return drives;
  }

  /**
   * Browse a directory without ignore patterns — for filesystem folder picker.
   * Sorts directories first, then files, alphabetically.
   */
  async browseDirectory(dirPath: string, depth = 1): Promise<FileEntry[]> {
    const resolved = resolve(dirPath);
    const entries: FileEntry[] = [];

    try {
      const items = await readdir(resolved, { withFileTypes: true });
      const dirs: FileEntry[] = [];
      const files: FileEntry[] = [];

      for (const item of items) {
        const fullPath = join(resolved, item.name);
        const entry: FileEntry = {
          path: fullPath.replace(/\\/g, '/'),
          name: item.name,
          type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file',
        };

        if (item.isFile()) {
          try {
            const st = await stat(fullPath);
            entry.size = st.size;
            entry.modifiedAt = st.mtime.toISOString();
          } catch {
            // stat may fail
          }
        }

        if (item.isDirectory()) {
          dirs.push(entry);
        } else {
          files.push(entry);
        }
      }

      dirs.sort((a, b) => a.name.localeCompare(b.name));
      files.sort((a, b) => a.name.localeCompare(b.name));
      entries.push(...dirs, ...files);
    } catch {
      // directory not accessible
    }

    return entries;
  }

  async listDirectory(dirPath: string, depth = 1): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    await this.walkDir(dirPath, dirPath, depth, 0, entries);
    return entries;
  }

  private async walkDir(
    rootPath: string,
    currentPath: string,
    maxDepth: number,
    currentDepth: number,
    results: FileEntry[],
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    const items = await readdir(currentPath, { withFileTypes: true });
    for (const item of items) {
      // Skip ignored
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;

      const fullPath = join(currentPath, item.name);
      const relPath = relative(rootPath, fullPath).replace(/\\/g, '/');

      const entry: FileEntry = {
        path: relPath,
        name: item.name,
        type: item.isDirectory() ? 'directory' : item.isSymbolicLink() ? 'symlink' : 'file',
      };

      if (item.isFile()) {
        try {
          const st = await stat(fullPath);
          entry.size = st.size;
          entry.modifiedAt = st.mtime.toISOString();
        } catch {
          // stat may fail, skip metadata
        }
      }

      results.push(entry);

      if (item.isDirectory()) {
        await this.walkDir(rootPath, fullPath, maxDepth, currentDepth + 1, results);
      }
    }
  }

  async searchFiles(rootPath: string, pattern: string, maxResults = 100): Promise<{ path: string }[]> {
    const results: { path: string }[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    await this.searchDir(rootPath, rootPath, regex, results, maxResults);
    return results;
  }

  private async searchDir(
    rootPath: string,
    currentPath: string,
    regex: RegExp,
    results: { path: string }[],
    maxResults: number,
  ): Promise<void> {
    if (results.length >= maxResults) return;
    const items = await readdir(currentPath, { withFileTypes: true });
    for (const item of items) {
      if (results.length >= maxResults) return;
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;

      const fullPath = join(currentPath, item.name);
      const relPath = relative(rootPath, fullPath).replace(/\\/g, '/');

      if (regex.test(basename(item.name))) {
        results.push({ path: relPath });
      }

      if (item.isDirectory()) {
        await this.searchDir(rootPath, fullPath, regex, results, maxResults);
      }
    }
  }

  onFileChange(handler: (change: FileChange) => void): void {
    this.changeHandlers.push(handler);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
  }

  async deleteFile(filePath: string): Promise<void> {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      await rm(filePath, { recursive: true });
    } else {
      await unlink(filePath);
    }
  }

  async createFile(filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/') || filePath.lastIndexOf('\\'));
    if (dir) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(filePath, '', 'utf-8');
  }

  async createDirectory(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  async closeAll(): Promise<void> {
    for (const watcher of this.watchers.values()) {
      await watcher.close();
    }
    this.watchers.clear();
  }
}
