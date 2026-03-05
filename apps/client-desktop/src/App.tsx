import { useStore } from 'zustand';
import { CoreConnectionProvider, connectionStore } from '@nexus-core/client-shared';
import { ConnectionDialog } from './components/connection-dialog.js';
import { AppLayout } from './components/app-layout.js';

function AppContent() {
  const state = useStore(connectionStore, (s) => s.state);

  if (state !== 'connected') {
    return <ConnectionDialog />;
  }

  return <AppLayout />;
}

export function App() {
  return (
    <CoreConnectionProvider>
      <AppContent />
    </CoreConnectionProvider>
  );
}
