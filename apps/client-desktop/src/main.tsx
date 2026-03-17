import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initChatSync, initTerminalSync, initWorkspaceSync } from '@nexus-core/client-shared';

import { App } from './App.js';
import './styles/global.css';

// Enable multi-client sync (broadcasts events across clients)
initChatSync();
initTerminalSync();
initWorkspaceSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
