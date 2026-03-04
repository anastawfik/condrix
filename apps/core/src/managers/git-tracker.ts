import type { GitStatusEntry, GitBranchInfo } from '@nexus-core/protocol';

/**
 * Tracks repository status, staged/unstaged changes, branch information,
 * and diff generation using simple-git.
 */
export class GitTracker {
  async getStatus(_repoPath: string): Promise<GitStatusEntry[]> {
    // TODO: Use simple-git to get repository status
    return [];
  }

  async getBranches(_repoPath: string): Promise<GitBranchInfo[]> {
    // TODO: List branches with tracking info
    return [];
  }

  async getDiff(_repoPath: string, _staged: boolean): Promise<string> {
    // TODO: Get diff output
    return '';
  }

  async stage(_repoPath: string, _paths: string[]): Promise<void> {
    // TODO: Stage files
  }

  async commit(_repoPath: string, _message: string): Promise<string> {
    // TODO: Create commit, return SHA
    return '';
  }
}
