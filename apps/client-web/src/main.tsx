import { createRoot } from 'react-dom/client';
import { initChatSync } from '@nexus-core/client-shared';
import { App } from './App.js';
import './styles/global.css';

// Enable multi-client chat sync (broadcasts agent events across clients)
initChatSync();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}
