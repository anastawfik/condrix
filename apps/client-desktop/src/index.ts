/**
 * @condrix/client-desktop
 *
 * Tauri 2.0 thin shell that loads the Condrix web client.
 * In dev mode, loads http://localhost:5173 (the Vite dev server).
 * In production, bundles the built web client assets.
 *
 * Contains a minimal fallback UI with URL input if the web client
 * is not available at the expected location.
 */

export { App } from './App.js';
