/**
 * Executes agent tools against a workspace's file system and shell.
 * Each tool call receives validated input and returns a string result.
 */
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { exec } from 'node:child_process';

const EXEC_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 50_000;

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export class ToolExecutor {
  constructor(private workspacePath: string) {}

  async execute(toolName: string, input: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'file_read':
          return await this.fileRead(input.path as string);
        case 'file_write':
          return await this.fileWrite(input.path as string, input.content as string);
        case 'file_edit':
          return await this.fileEdit(input.path as string, input.old_string as string, input.new_string as string);
        case 'list_directory':
          return await this.listDirectory(input.path as string);
        case 'terminal_exec':
          return await this.terminalExec(input.command as string);
        case 'search_files':
          return await this.searchFiles(input.pattern as string);
        default:
          return { content: `Unknown tool: ${toolName}`, isError: true };
      }
    } catch (err) {
      return {
        content: err instanceof Error ? err.message : String(err),
        isError: true,
      };
    }
  }

  private resolvePath(relPath: string): string {
    const resolved = join(this.workspacePath, relPath);
    // Prevent path traversal outside workspace
    if (!resolved.startsWith(this.workspacePath)) {
      throw new Error('Path traversal outside workspace is not allowed');
    }
    return resolved;
  }

  private async fileRead(path: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(path);
    const content = await readFile(fullPath, 'utf-8');
    if (content.length > MAX_OUTPUT_CHARS) {
      return { content: content.slice(0, MAX_OUTPUT_CHARS) + '\n\n[... truncated]' };
    }
    return { content };
  }

  private async fileWrite(path: string, content: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
    return { content: `File written: ${path} (${content.length} bytes)` };
  }

  private async fileEdit(path: string, oldString: string, newString: string): Promise<ToolResult> {
    const fullPath = this.resolvePath(path);
    const content = await readFile(fullPath, 'utf-8');
    const index = content.indexOf(oldString);
    if (index === -1) {
      return { content: 'old_string not found in file. Make sure it matches exactly.', isError: true };
    }
    // Check for multiple matches
    const secondIndex = content.indexOf(oldString, index + 1);
    if (secondIndex !== -1) {
      return { content: 'old_string matches multiple locations. Provide more context to make it unique.', isError: true };
    }
    const updated = content.slice(0, index) + newString + content.slice(index + oldString.length);
    await writeFile(fullPath, updated, 'utf-8');
    return { content: `File edited: ${path}` };
  }

  private async listDirectory(path: string): Promise<ToolResult> {
    const dirPath = path && path !== '.' ? this.resolvePath(path) : this.workspacePath;
    const items = await readdir(dirPath, { withFileTypes: true });
    const lines = items
      .filter((item) => item.name !== 'node_modules' && item.name !== '.git')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((item) => (item.isDirectory() ? `${item.name}/` : item.name));
    return { content: lines.join('\n') || '(empty directory)' };
  }

  private async terminalExec(command: string): Promise<ToolResult> {
    return new Promise((resolve) => {
      exec(command, { cwd: this.workspacePath, timeout: EXEC_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
        let output = '';
        if (stdout) output += stdout;
        if (stderr) output += (output ? '\n' : '') + stderr;
        if (err && !output) output = err.message;

        if (output.length > MAX_OUTPUT_CHARS) {
          output = output.slice(0, MAX_OUTPUT_CHARS) + '\n\n[... truncated]';
        }

        resolve({
          content: output || '(no output)',
          isError: err ? true : undefined,
        });
      });
    });
  }

  private async searchFiles(pattern: string): Promise<ToolResult> {
    const results: string[] = [];
    await this.walkForSearch(this.workspacePath, pattern, results, 200);
    return { content: results.length > 0 ? results.join('\n') : 'No matching files found' };
  }

  private async walkForSearch(dir: string, pattern: string, results: string[], max: number): Promise<void> {
    if (results.length >= max) return;
    const items = await readdir(dir, { withFileTypes: true });
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');

    for (const item of items) {
      if (results.length >= max) return;
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') continue;

      const fullPath = join(dir, item.name);
      const relPath = fullPath.slice(this.workspacePath.length + 1).replace(/\\/g, '/');

      if (regex.test(item.name)) {
        results.push(item.isDirectory() ? relPath + '/' : relPath);
      }

      if (item.isDirectory()) {
        await this.walkForSearch(fullPath, pattern, results, max);
      }
    }
  }
}
