import { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { MessageSquarePlus, Check, ChevronDown } from 'lucide-react';
import { workspaceStore } from '@nexus-core/client-shared';
import { useWorkspaceConfig } from '@nexus-core/client-shared';
import {
  DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItemComponent,
  Popover, PopoverContent, PopoverTrigger,
  Tooltip, TooltipProvider,
} from '@nexus-core/client-components';

const MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
];

const DEFAULT_MODEL = 'claude-sonnet-4-5';

export function ChatHeader() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { config, setConfig } = useWorkspaceConfig(workspaceId);

  if (!workspaceId) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]" data-testid="chat-header">
        <ModelSelector
          value={config.model}
          onChange={(model) => setConfig('model', model)}
        />
        <SystemPromptEditor
          value={config.systemPrompt}
          onChange={(prompt) => setConfig('systemPrompt', prompt || undefined)}
        />
      </div>
    </TooltipProvider>
  );
}

/* ─── Model Selector ───────────────────────────────────────────────────── */

function ModelSelector({ value, onChange }: { value?: string; onChange: (model: string) => void }) {
  const current = MODELS.find((m) => m.id === value) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="model-selector"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
        >
          <span>{current.label}</span>
          <ChevronDown size={12} className="opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px]">
        {MODELS.map((m) => (
          <DropdownMenuItemComponent
            key={m.id}
            onClick={() => onChange(m.id)}
            className="flex items-center justify-between text-xs"
          >
            <span>{m.label}</span>
            {m.id === (value ?? DEFAULT_MODEL) && <Check size={14} className="text-[var(--accent-blue)]" />}
          </DropdownMenuItemComponent>
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}

/* ─── System Prompt Editor ─────────────────────────────────────────────── */

function SystemPromptEditor({ value, onChange }: { value?: string; onChange: (prompt: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '').trim()) {
      onChange(trimmed);
    }
    setOpen(false);
  };

  const hasPrompt = !!(value && value.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content={hasPrompt ? 'Edit system prompt' : 'Add system prompt'}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)] ${
              hasPrompt
                ? 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10 hover:bg-[var(--accent-blue)]/15'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <MessageSquarePlus size={14} />
            <span>{hasPrompt ? 'System Prompt' : 'Add System Prompt'}</span>
          </button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent className="w-80 p-3 space-y-2.5" align="start">
        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          System Prompt
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={4}
          className="w-full px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm resize-y focus:outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)]"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          {hasPrompt && (
            <button
              onClick={() => { setDraft(''); onChange(''); setOpen(false); }}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--accent-red)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] transition-colors"
          >
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
