# NexusCore

**Distributed AI Agent Orchestration Platform**

NexusCore orchestrates AI coding agents across multiple machines, accessible from any device in real-time. Start a coding session on your desktop, check progress from your phone, continue from a laptop — without losing context.

## Architecture

NexusCore is built on three layers:

| Layer | Role | Technology |
|-------|------|-----------|
| **Core** | Agent runtime daemon — manages projects, workspaces, agents, terminals, files, git | Node.js, WebSocket, SQLite, node-pty |
| **Maestro** | Orchestration — cross-core awareness, messaging bridge, proactive notifications | Node.js, grammy, baileys, SQLite |
| **Clients** | Stateless UIs that connect to Cores for IDE-like experiences | Tauri, React, React Native, Ink |

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Desktop    │     │     Web      │     │    Mobile    │
│  (Tauri+React)│     │ (React+Vite) │     │(React Native)│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │    WebSocket       │                    │
       └───────────┬────────┘────────────────────┘
                   │
          ┌────────▼────────┐
          │      Core       │  ← Agent runtime (1 per machine)
          │  (Node.js daemon)│
          └────────┬────────┘
                   │ Events
          ┌────────▼────────┐
          │     Maestro     │  ← Orchestration hub
          │ (Coordination)  │──── WhatsApp / Telegram
          └─────────────────┘
```

## Monorepo Structure

```
apps/                        # Deployable applications & services
  core/                      # Core daemon (Node.js)
  maestro/                   # Maestro orchestration service
  client-desktop/            # Tauri desktop app
  client-web/                # Web client (Vite + React)
  client-mobile/             # React Native app
  client-cli/                # CLI client (Ink)
  docs/                      # Documentation (VitePress)
libs/                        # Shared libraries
  protocol/                  # Shared types & message schemas
  client-shared/             # Shared React components/hooks
  skills/                    # Built-in agent skill definitions
  mcp-configs/               # MCP server configurations
```

## Prerequisites

- **Node.js** >= 22.0.0
- **npm** >= 10.0.0

## Getting Started

```bash
# Clone the repository
git clone <repo-url> nexus-core
cd nexus-core

# Install all dependencies
npm install

# Build all packages
npm run build

# Start the Core daemon (dev mode)
npm run dev:core

# Start the web client (dev mode)
npm run dev:web

# View the dependency graph
npx nx graph
```

## Development

```bash
# Run all tests
npm test

# Lint all packages
npm run lint

# Type-check everything
npm run typecheck

# Build/test only affected packages (after changes)
npx nx affected -t build
npx nx affected -t test
```

## Key Concepts

### Workspaces
A workspace is an isolated environment within a project — its own agent session, terminals, git worktree, and file watchers. Workspaces follow a state machine: `CREATING → IDLE → ACTIVE → WAITING → SUSPENDED → DESTROYED`.

### Skills
Composable capability packages that equip agents with domain-specific knowledge (TypeScript, React, DevOps, etc.) and tool access.

### MCP Servers
Model Context Protocol servers extend agent capabilities with tools for filesystem, git, database, browser, search, and more.

### Messaging Bridge
Maestro integrates with WhatsApp and Telegram for proactive notifications when agents need human input, enabling approval/rejection directly from your phone.

## Development Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Core daemon + CLI + basic Desktop | In Progress |
| **Phase 2** | Maestro + multi-core + messaging | Planned |
| **Phase 3** | Rich Desktop/Web clients (Monaco, Git UI) | Planned |
| **Phase 4** | Mobile client + advanced orchestration | Planned |

## Documentation

Full architecture document: [`apps/docs/architecture/NexusCore-Architecture-v1.0.md`](apps/docs/architecture/NexusCore-Architecture-v1.0.md)

## License

TBD
