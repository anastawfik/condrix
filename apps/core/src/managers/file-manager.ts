import type { FileEntry, FileChange } from '@nexus-core/protocol';

/**
 * Watches project directories for changes, serves file contents to clients,
 * and handles file edits from both agents and users.
 */
export class FileManager {
  async watchDirectory(_path: string): Promise<void> {
    // TODO: Initialize chokidar watcher
  }

  async readFile(_path: string): Promise<string> {
    // TODO: Read file contents
    return '';
  }

  async writeFile(_path: string, _content: string): Promise<void> {
    // TODO: Write file contents atomically
  }

  async listDirectory(_path: string): Promise<FileEntry[]> {
    // TODO: List directory entries
    return [];
  }

  async searchFiles(_rootPath: string, _pattern: string): Promise<FileEntry[]> {
    // TODO: Search files using glob/ripgrep
    return [];
  }

  onFileChange(_handler: (change: FileChange) => void): void {
    // TODO: Register file change handler
  }
}
