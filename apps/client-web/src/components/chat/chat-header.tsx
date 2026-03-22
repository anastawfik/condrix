import { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import { MessageSquarePlus, Check, ChevronDown } from 'lucide-react';
import { workspaceStore } from '@nexus-core/client-shared';
import { useWorkspaceConfig } from '@nexus-core/client-shared';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const MODELS = [
  { id: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5-20250514', label: 'Claude Opus 4.5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250514';

export function ChatHeader() {
  const workspaceId = useStore(workspaceStore, (s) => s.currentWorkspaceId);
  const { config, setConfig } = useWorkspaceConfig(workspaceId);

  if (!workspaceId) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card">
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

function ModelSelector({ value, onChange }: { value?: string; onChange: (model: string) => void }) {
  const current = MODELS.find((m) => m.id === value) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          {current.label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        {MODELS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className="flex items-center justify-between"
          >
            {m.label}
            {m.id === (value ?? DEFAULT_MODEL) && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SystemPromptEditor({ value, onChange }: { value?: string; onChange: (prompt: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '').trim()) onChange(trimmed);
    setOpen(false);
  };

  const hasPrompt = !!(value && value.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant={hasPrompt ? 'secondary' : 'ghost'} size="sm" className="gap-1.5">
              <MessageSquarePlus className="size-4" />
              {hasPrompt ? 'System Prompt' : 'Add System Prompt'}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{hasPrompt ? 'Edit system prompt' : 'Add system prompt'}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80 space-y-3" align="start">
        <label className="block text-sm font-medium text-muted-foreground">System Prompt</label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="You are a helpful assistant..."
          rows={4}
          className="w-full px-3 py-2 rounded-md bg-background border border-border text-foreground text-sm resize-y focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          {hasPrompt && (
            <Button variant="ghost" size="sm" onClick={() => { setDraft(''); onChange(''); setOpen(false); }} className="text-destructive">
              Clear
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
