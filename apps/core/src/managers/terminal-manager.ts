import type { TerminalInfo } from '@nexus-core/protocol';

/**
 * Creates and manages pseudo-terminal (PTY) sessions per workspace.
 * Streams output to connected clients in real-time.
 */
export class TerminalManager {
  private terminals = new Map<string, TerminalInfo>();

  async createTerminal(workspaceId: string, shell?: string): Promise<TerminalInfo> {
    const terminal: TerminalInfo = {
      id: `term_${Date.now()}`,
      workspaceId,
      shell: shell ?? process.env.SHELL ?? '/bin/bash',
      cols: 80,
      rows: 24,
    };
    this.terminals.set(terminal.id, terminal);
    // TODO: Spawn PTY process via node-pty
    return terminal;
  }

  async writeToTerminal(_terminalId: string, _data: string): Promise<void> {
    // TODO: Write data to PTY stdin
  }

  async resizeTerminal(_terminalId: string, _cols: number, _rows: number): Promise<void> {
    // TODO: Resize PTY
  }

  async closeTerminal(terminalId: string): Promise<void> {
    // TODO: Kill PTY process
    this.terminals.delete(terminalId);
  }

  listTerminals(workspaceId: string): TerminalInfo[] {
    return Array.from(this.terminals.values()).filter((t) => t.workspaceId === workspaceId);
  }
}
