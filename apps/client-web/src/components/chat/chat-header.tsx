import { useState, useRef, useEffect } from 'react';
import { useStore } from 'zustand';
import { workspaceStore } from '@nexus-core/client-shared';
import { useWorkspaceConfig, type WorkspaceConfig } from '@nexus-core/client-shared';

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
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <ModelSelector
        value={config.model}
        onChange={(model) => setConfig('model', model)}
      />
      <SystemPromptEditor
        value={config.systemPrompt}
        onChange={(prompt) => setConfig('systemPrompt', prompt || undefined)}
      />
    </div>
  );
}

/* ─── Model Selector ───────────────────────────────────────────────────── */

function ModelSelector({ value, onChange }: { value?: string; onChange: (model: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = MODELS.find((m) => m.id === value) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span>{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4 L5 7 L8 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 py-1 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg z-50">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                m.id === (value ?? DEFAULT_MODEL)
                  ? 'bg-[var(--bg-active)] text-[var(--accent-blue)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── System Prompt Editor ─────────────────────────────────────────────── */

function SystemPromptEditor({ value, onChange }: { value?: string; onChange: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, draft]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '').trim()) {
      onChange(trimmed);
    }
    setOpen(false);
  };

  const hasPrompt = !!(value && value.trim());

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
          hasPrompt
            ? 'text-[var(--accent-blue)] hover:bg-[var(--bg-hover)]'
            : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
        }`}
        title={hasPrompt ? value : 'Set system prompt'}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M6 1v10M1 6h10" strokeLinecap="round" />
          <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
        </svg>
        <span>{hasPrompt ? 'System Prompt' : 'Add System Prompt'}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 p-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg z-50 space-y-2">
          <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
            System Prompt
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="You are a helpful assistant..."
            rows={4}
            className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs resize-y focus:outline-none focus:border-[var(--accent-blue)]"
            autoFocus
          />
          <div className="flex justify-end gap-1.5">
            {hasPrompt && (
              <button
                onClick={() => { setDraft(''); onChange(''); setOpen(false); }}
                className="px-2 py-1 rounded text-[10px] text-[var(--accent-red)] hover:bg-[var(--bg-hover)]"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="px-2 py-1 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-2 py-1 rounded text-[10px] bg-[var(--accent-blue)] text-white hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
