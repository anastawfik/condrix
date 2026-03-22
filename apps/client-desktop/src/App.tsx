import { useState, useCallback } from 'react';

/**
 * Minimal fallback UI for the Tauri desktop shell.
 *
 * In normal operation, Tauri loads the web client directly (devUrl or frontendDist).
 * This fallback only shows if the bundled frontend fails to load, providing
 * a URL input so the user can point the window at a running web client instance.
 */
export function App() {
  const [url, setUrl] = useState('http://localhost:5173');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = useCallback(() => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }
    setLoading(true);
    setError(null);

    // Navigate the current window to the web client URL
    window.location.href = url.trim();
  }, [url]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConnect();
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#1e1e2e',
      color: '#cdd6f4',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        NexusCore
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#6c7086', marginBottom: '2rem', textAlign: 'center' }}>
        Enter the URL of a running NexusCore web client to connect.
      </p>

      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="http://localhost:5173"
          autoFocus
          style={{
            width: '100%',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            border: '1px solid #45475a',
            backgroundColor: '#313244',
            color: '#cdd6f4',
            fontSize: '0.85rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            padding: '0.6rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#89b4fa',
            color: '#1e1e2e',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>

        {error && (
          <p style={{ fontSize: '0.8rem', color: '#f38ba8', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>

      <p style={{ fontSize: '0.7rem', color: '#585b70', marginTop: '2rem', textAlign: 'center' }}>
        Start the web client with: npm run dev:web
      </p>
    </div>
  );
}
