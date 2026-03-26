import type { GitStatusEntry, GitBranchInfo } from '@condrix/protocol';
import { simpleGit, type SimpleGit, type StatusResult, type BranchSummary } from 'simple-git';

/**
 * Tracks repository status, staged/unstaged changes, branch information,
 * and diff generation using simple-git.
 */
export class GitTracker {
  private getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath);
  }

  async getStatus(repoPath: string): Promise<{
    entries: GitStatusEntry[];
    branch: string;
    clean: boolean;
  }> {
    const git = this.getGit(repoPath);
    const status: StatusResult = await git.status();

    const entries: GitStatusEntry[] = [];
    const seen = new Set<string>();

    for (const file of status.staged) {
      seen.add(file);
      entries.push({ path: file, status: 'modified', staged: true });
    }
    for (const file of status.created) {
      if (!seen.has(file)) {
        seen.add(file);
        entries.push({ path: file, status: 'added', staged: status.staged.includes(file) });
      }
    }
    for (const file of status.deleted) {
      if (!seen.has(file)) {
        seen.add(file);
        entries.push({ path: file, status: 'deleted', staged: status.staged.includes(file) });
      }
    }
    for (const file of status.renamed) {
      const path = (file as unknown as { to: string }).to ?? String(file);
      if (!seen.has(path)) {
        seen.add(path);
        entries.push({ path, status: 'renamed', staged: true });
      }
    }
    for (const file of status.modified) {
      if (!seen.has(file)) {
        seen.add(file);
        entries.push({ path: file, status: 'modified', staged: false });
      }
    }
    for (const file of status.not_added) {
      if (!seen.has(file)) {
        seen.add(file);
        entries.push({ path: file, status: 'untracked', staged: false });
      }
    }

    return {
      entries,
      branch: status.current ?? 'HEAD',
      clean: status.isClean(),
    };
  }

  async getBranches(repoPath: string): Promise<{
    branches: GitBranchInfo[];
    current: string;
  }> {
    const git = this.getGit(repoPath);
    const summary: BranchSummary = await git.branch();

    const branches: GitBranchInfo[] = Object.values(summary.branches).map((b) => ({
      name: b.name,
      current: b.current,
      remote: b.name.startsWith('remotes/') ? b.name : undefined,
      ahead: 0,
      behind: 0,
    }));

    return {
      branches,
      current: summary.current,
    };
  }

  async getDiff(repoPath: string, staged = false, path?: string): Promise<{
    diff: string;
    files: string[];
  }> {
    const git = this.getGit(repoPath);
    const args = staged ? ['--cached'] : [];
    if (path) args.push('--', path);
    const diff = await git.diff(args);

    const diffStat = await git.diffSummary(staged ? ['--cached'] : []);
    const files = diffStat.files.map((f) => f.file);

    return { diff, files };
  }

  async getLog(repoPath: string, limit = 20, branch?: string): Promise<{
    commits: { hash: string; message: string; author: string; date: string }[];
  }> {
    const git = this.getGit(repoPath);
    const options: string[] = [`--max-count=${limit}`];
    if (branch) options.push(branch);
    const log = await git.log(options);

    return {
      commits: log.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
      })),
    };
  }

  async stage(repoPath: string, paths: string[]): Promise<string[]> {
    const git = this.getGit(repoPath);
    await git.add(paths);
    return paths;
  }

  async unstage(repoPath: string, paths: string[]): Promise<string[]> {
    const git = this.getGit(repoPath);
    await git.reset(['--', ...paths]);
    return paths;
  }

  async commit(repoPath: string, message: string): Promise<{ hash: string; message: string }> {
    const git = this.getGit(repoPath);
    const result = await git.commit(message);
    return { hash: result.commit, message };
  }
}
