import { useState } from 'react';
import { FolderOpen, Globe } from 'lucide-react';
import { workspaceStore } from '@nexus-core/client-shared';
import { Dialog } from './dialog.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { Tabs, TabList, Tab, TabPanel } from './tabs.js';
import { FolderBrowser } from './folder-browser.js';

export interface AddProjectDialogProps {
  coreId: string;
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

/** Extract folder name from a path (handles both / and \ separators). */
function folderName(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '');
  const sep = trimmed.lastIndexOf('/') !== -1 ? '/' : '\\';
  return trimmed.slice(trimmed.lastIndexOf(sep) + 1) || trimmed;
}

/** Extract repo name from a git URL. */
function repoNameFromUrl(url: string): string {
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? '';
}

export function AddProjectDialog({ coreId, open, onClose, onCreated }: AddProjectDialogProps) {
  const [selectedPath, setSelectedPath] = useState('');
  const [name, setName] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitName, setGitName] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('folder');

  const handleFolderSelected = (path: string) => {
    setSelectedPath(path);
    setName(folderName(path));
  };

  const handleGitUrlChange = (url: string) => {
    setGitUrl(url);
    const derived = repoNameFromUrl(url);
    if (derived) setGitName(derived);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      let project;
      if (activeTab === 'folder' && selectedPath) {
        project = await workspaceStore.getState().createProject(
          name || folderName(selectedPath),
          { path: selectedPath },
          coreId,
        );
      } else if (activeTab === 'git' && gitUrl) {
        project = await workspaceStore.getState().createProject(
          gitName || repoNameFromUrl(gitUrl),
          { url: gitUrl },
          coreId,
        );
      }
      if (project) {
        onCreated?.(project.id);
        onClose();
        resetForm();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create project';
      setError(msg);
      console.error('[AddProject] Failed to create project:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPath('');
    setName('');
    setGitUrl('');
    setGitName('');
    setError('');
  };

  const canCreate = activeTab === 'folder' ? !!selectedPath : !!gitUrl;

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Add Project" className="w-[440px]">
        <Tabs defaultTab="folder" onChange={(id) => setActiveTab(id)}>
          <TabList className="px-4">
            <Tab id="folder" icon={<FolderOpen size={12} />}>Local Folder</Tab>
            <Tab id="git" icon={<Globe size={12} />}>Git URL</Tab>
          </TabList>

          <TabPanel id="folder" className="p-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Folder</label>
              <div className="flex gap-2">
                <Input
                  value={selectedPath}
                  onChange={(e) => {
                    setSelectedPath(e.target.value);
                    if (e.target.value) setName(folderName(e.target.value));
                  }}
                  placeholder="/path/to/project or Browse..."
                  inputSize="sm"
                  className="flex-1"
                />
                <Button size="sm" variant="secondary" onClick={() => setBrowserOpen(true)}>
                  Browse...
                </Button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name (auto-derived)"
                inputSize="sm"
              />
            </div>
          </TabPanel>

          <TabPanel id="git" className="p-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Repository URL</label>
              <Input
                value={gitUrl}
                onChange={(e) => handleGitUrlChange(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                inputSize="sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Name</label>
              <Input
                value={gitName}
                onChange={(e) => setGitName(e.target.value)}
                placeholder="Project name (auto-derived)"
                inputSize="sm"
              />
            </div>
          </TabPanel>
        </Tabs>

        {error && (
          <div className="mx-4 mb-1 px-3 py-2 rounded bg-[var(--accent-red)]/10 text-[var(--accent-red)] text-xs">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border-color)]">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={!canCreate || loading}>
            {loading ? 'Creating...' : 'Add Project'}
          </Button>
        </div>
      </Dialog>

      <FolderBrowser
        coreId={coreId}
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={handleFolderSelected}
      />
    </>
  );
}
