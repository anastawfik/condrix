import { useState, type ComponentType } from 'react';
import { ModelSettings } from './model-settings.js';
import { GeneralSettings } from './general-settings.js';
import { ThemeSettings } from './theme-settings.js';
import { NotificationSettings } from './notification-settings.js';

interface TabDefinition {
  id: string;
  label: string;
  icon: string;
  component: ComponentType;
}

const TABS: TabDefinition[] = [
  { id: 'model', label: 'Model', icon: '\u2699', component: ModelSettings },
  { id: 'general', label: 'General', icon: '\u2630', component: GeneralSettings },
  { id: 'theme', label: 'Theme', icon: '\u263E', component: ThemeSettings },
  { id: 'notifications', label: 'Notifications', icon: '\u266A', component: NotificationSettings },
];

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('model');
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component ?? ModelSettings;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex w-[640px] h-[480px] rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left sidebar tabs */}
        <div className="w-44 shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-primary)] py-3">
          <div className="px-4 pb-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Settings
          </div>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--bg-active)] text-[var(--accent-blue)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span className="w-5 text-center">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-end p-2">
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              aria-label="Close settings"
            >
              &#x2715;
            </button>
          </div>
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
