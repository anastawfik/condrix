import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initChatSync } from '@nexus-core/client-shared';

import { App } from './App.js';
import './styles/global.css';

// Enable multi-client chat sync (broadcasts agent events across clients)
initChatSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
