import { useState, useEffect, useRef, useMemo, type ComponentType } from 'react';
import { GeneralSettings } from './general-settings.js';
import { ThemeSettings } from './theme-settings.js';
import { NotificationSettings } from './notification-settings.js';
import { CoresSettingsTab, AiSettingsTab, AuthenticationSettingsTab } from '@nexus-core/client-components';
import { maestroStore } from '@nexus-core/client-shared';
import type { MaestroConnectionState } from '@nexus-core/client-shared';

interface TabDefinition {
  id: string;
  label: string;
  icon: string;
  component: ComponentType;
}

const STATIC_TABS: TabDefinition[] = [
  { id: 'cores', label: 'Cores', icon: '\u26A1', component: CoresSettingsTab },
  { id: 'ai', label: 'AI', icon: '\u2728', component: AiSettingsTab },
  { id: 'theme', label: 'Theme', icon: '\u263E', component: ThemeSettings },
  { id: 'notifications', label: 'Notifications', icon: '\u266A', component: NotificationSettings },
  { id: 'general', label: 'General', icon: '\u2630', component: GeneralSettings },
];

const AUTH_TAB: TabDefinition = {
  id: 'authentication', label: 'Account', icon: '\uD83D\uDD12', component: AuthenticationSettingsTab,
};

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('cores');
  const [maestroState, setMaestroState] = useState<MaestroConnectionState>(
    () => maestroStore.getState().state,
  );

  useEffect(() => {
    const unsub = maestroStore.subscribe((s) => setMaestroState(s.state));
    return unsub;
  }, []);

  const tabs = useMemo(() => {
    if (maestroState === 'connected') {
      // Insert Account tab after AI
      const result = [...STATIC_TABS];
      const aiIdx = result.findIndex((t) => t.id === 'ai');
      result.splice(aiIdx + 1, 0, AUTH_TAB);
      return result;
    }
    return STATIC_TABS;
  }, [maestroState]);

  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component ?? CoresSettingsTab;
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // Focus the dialog on mount
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        className="flex w-[640px] max-w-[95vw] h-[480px] max-h-[90vh] rounded-lg overflow-hidden bg-card border border-border shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-44 shrink-0 border-r border-border bg-background py-3">
          <div className="px-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Settings
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                activeTab === tab.id
                  ? 'bg-muted text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              <span className="w-5 text-center">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-end p-2">
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
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
