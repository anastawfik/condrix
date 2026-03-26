import { createRoot } from 'react-dom/client';
import { initChatSync, initTerminalSync, initWorkspaceSync } from '@condrix/client-shared';
import { App } from './App.js';
import './styles/global.css';

// Enable multi-client sync (broadcasts events across clients)
initChatSync();
initTerminalSync();
initWorkspaceSync();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
