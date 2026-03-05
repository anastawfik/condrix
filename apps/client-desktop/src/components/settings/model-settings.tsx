import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@nexus-core/client-shared';

const MODELS = [
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
];

const MASK_CHAR = '\u2022';

export function ModelSettings() {
  const { settings, loading, setSetting, reload } = useSettings('model.');

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-5');
  const [maxTokens, setMaxTokens] = useState('8192');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync local state from loaded settings
  useEffect(() => {
    if (loading) return;
    const savedKey = settings['model.apiKey'] as string | undefined;
    if (savedKey) setApiKey(savedKey);
    const savedModel = settings['model.id'] as string | undefined;
    if (savedModel) setModel(savedModel);
    const savedTokens = settings['model.maxTokens'] as number | undefined;
    if (savedTokens) setMaxTokens(String(savedTokens));
    const savedPrompt = settings['model.systemPrompt'] as string | undefined;
    if (savedPrompt !== undefined) setSystemPrompt(savedPrompt);
  }, [settings, loading]);

  const isMaskedValue = useCallback((value: string) => {
    return value.startsWith(MASK_CHAR);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      // Only send API key if user changed it (not the masked value)
      if (!isMaskedValue(apiKey) && apiKey.trim()) {
        await setSetting('model.apiKey', apiKey.trim());
      }
      await setSetting('model.id', model);
      await setSetting('model.maxTokens', parseInt(maxTokens, 10) || 8192);
      await setSetting('model.systemPrompt', systemPrompt);

      setStatus({ type: 'success', message: 'Settings saved' });
      await reload('model.');
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-[var(--text-secondary)]">Loading settings...</div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-lg">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">Model Settings</h2>

      {/* API Key */}
      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Anthropic API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Max Tokens */}
      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">Max Output Tokens</label>
        <input
          type="number"
          value={maxTokens}
          onChange={(e) => setMaxTokens(e.target.value)}
          min={1}
          max={128000}
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      {/* System Prompt */}
      <div className="space-y-1.5">
        <label className="block text-sm text-[var(--text-secondary)]">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          placeholder="Optional system prompt for all conversations..."
          className="w-full px-3 py-2 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-primary)] text-sm resize-y focus:outline-none focus:border-[var(--accent-blue)]"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {status && (
          <span className={`text-sm ${status.type === 'success' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-red)]'}`}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
