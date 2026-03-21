import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Prevent Cloudflare tunnel from caching pre-bundled deps in dev mode.
// Vite sets immutable cache on deps, but stale CF edge cache causes React
// version mismatches after rebuilds.
function noCacheDeps(): Plugin {
  return {
    name: 'no-cache-deps',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.includes('.vite/deps')) {
          res.setHeader('Cache-Control', 'no-store');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), noCacheDeps()],
  resolve: {
    dedupe: ['react', 'react-dom', 'zustand'],
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('monaco-editor') || id.includes('@monaco-editor/react')) return 'monaco';
          if (id.includes('highlight.js') || id.includes('lowlight') || id.includes('rehype-highlight')) return 'highlight';
          if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified') || id.includes('mdast') || id.includes('hast') || id.includes('micromark') || id.includes('unist')) return 'markdown';
          if (id.includes('node_modules/react-dom')) return 'react-vendor';
          if (id.includes('node_modules/react/')) return 'react-vendor';
          if (id.includes('@xterm/')) return 'xterm';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('radix-ui') || id.includes('radix')) return 'radix';
        },
      },
    },
  },
});
