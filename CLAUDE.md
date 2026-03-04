# CLAUDE.md — NexusCore

This file provides context for AI assistants working on the NexusCore codebase.

## Project Overview

NexusCore is a **Distributed AI Agent Orchestration Platform** with a three-layer architecture:

- **Core** — Headless agent runtime daemon that manages projects, workspaces, AI agents, terminals, and file operations
- **Maestro** — Central orchestration service for cross-core coordination, messaging bridge (WhatsApp/Telegram), and proactive notifications
- **Clients** — Stateless UI interfaces (CLI, Desktop, Web, Mobile) that connect to Cores via WebSocket

See `apps/docs/architecture/NexusCore-Architecture-v1.0.md` for the full architecture document.

## Monorepo Structure

```
nexus-core/                  # NX monorepo root
├── apps/                    # Deployable applications and services
│   ├── core/                # Core daemon (Node.js)
│   ├── maestro/             # Maestro orchestration service
│   ├── client-desktop/      # Tauri 2.0 + React + Monaco desktop app
│   ├── client-web/          # Vite + React web client
│   ├── client-mobile/       # React Native mobile app
│   ├── client-cli/          # CLI client using Ink (React for terminals)
│   └── docs/                # VitePress documentation site
├── libs/                    # Shared libraries (imported by apps)
│   ├── protocol/            # Shared message types, schemas, interfaces
│   ├── client-shared/       # Shared React components/hooks for clients
│   ├── skills/              # Built-in agent skill definitions
│   └── mcp-configs/         # Pre-configured MCP server definitions
├── docs/                    # Source architecture documents
├── nx.json                  # NX workspace configuration
├── tsconfig.base.json       # Base TypeScript config (all packages extend this)
└── package.json             # Root — npm workspaces + NX scripts
```

## Tech Stack

| Area | Technology |
|------|-----------|
| Language | TypeScript (strict mode) throughout |
| Runtime | Node.js 22+ |
| Monorepo | NX with npm workspaces |
| Build | TypeScript compiler (`tsc`) for libraries, Vite for client apps |
| Test | Vitest |
| Lint | ESLint 9 (flat config) + Prettier |
| Desktop | Tauri 2.0 + React + Monaco Editor |
| Web | React + Vite |
| Mobile | React Native (Expo) |
| CLI | Ink (React for CLI) + Commander |
| WebSocket | `ws` library |
| Database | better-sqlite3 |
| Git | simple-git |
| Terminal | node-pty |
| Messaging | grammy (Telegram), @whiskeysockets/baileys (WhatsApp) |

## Development Commands

```bash
# Install dependencies
npm install

# Build all packages (respects dependency graph)
npm run build          # or: npx nx run-many -t build

# Run individual services in dev mode
npm run dev:core       # Core daemon with hot-reload
npm run dev:maestro    # Maestro service with hot-reload
npm run dev:web        # Web client dev server
npm run dev:cli        # CLI client

# Test / Lint / Typecheck
npm test               # Run all tests
npm run lint           # Lint all packages
npm run typecheck      # Type-check all packages

# NX-specific
npx nx graph           # Visualize dependency graph
npx nx run @nexus-core/core:build   # Build a specific package
npx nx affected -t test              # Test only affected packages
```

## Dependency Graph

```
libs/protocol (no deps — foundation layer)
  ↑
  ├── libs/skills (depends on: protocol)
  ├── libs/mcp-configs (depends on: protocol)
  ├── libs/client-shared (depends on: protocol)
  │     ↑
  │     ├── apps/client-desktop (depends on: protocol, client-shared)
  │     ├── apps/client-web (depends on: protocol, client-shared)
  │     └── apps/client-mobile (depends on: protocol, client-shared)
  ├── apps/core (depends on: protocol)
  ├── apps/maestro (depends on: protocol)
  └── apps/client-cli (depends on: protocol)
```

**Rule:** `protocol` is the only lib that other packages may depend on for shared types. Apps must never import from `core` or `maestro` directly — they communicate via the WebSocket protocol.

## Coding Conventions

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig)
- Use `type` imports: `import type { Foo } from '...'`
- Prefer `interface` for object shapes, `type` for unions/intersections
- All packages use ES modules (`"type": "module"`)
- Target ES2023 with NodeNext module resolution (for Node.js packages)
- Use Bundler module resolution for client apps (Vite-based)

### Naming
- Files: `kebab-case.ts` (e.g., `workspace-manager.ts`)
- Classes: `PascalCase` (e.g., `WorkspaceManager`)
- Interfaces/Types: `PascalCase` (e.g., `WorkspaceInfo`)
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for true constants, `camelCase` for complex objects
- Package names: `@nexus-core/<name>` (e.g., `@nexus-core/protocol`)

### Architecture Patterns
- Core and Maestro use a **Manager pattern** — each domain concern has a dedicated manager class
- Clients are **stateless** — all state lives in the Core, clients only render
- Communication uses a **message envelope** pattern with namespaces and correlation IDs
- Workspace lifecycle follows a **state machine** (CREATING → IDLE → ACTIVE → WAITING → SUSPENDED → DESTROYED)
- MCP servers and Skills are **pluggable** — registered via configuration, loaded dynamically

### Testing
- Use Vitest for all tests
- Test files: `*.test.ts` or `*.spec.ts` co-located with source
- Focus on unit tests for managers and protocol logic
- Integration tests for WebSocket communication

### Git
- Branch naming: `feat/<name>`, `fix/<name>`, `chore/<name>`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`)
- Keep commits focused and atomic

## Key Design Decisions

1. **WebSocket-only communication** — No REST API. All Core↔Client and Core↔Maestro communication uses WebSocket with the message envelope protocol defined in `@nexus-core/protocol`.

2. **SQLite for persistence** — Both Core and Maestro use better-sqlite3. No external database dependency for single-developer use. PostgreSQL is an option for team deployments.

3. **Tauri over Electron** — Desktop client uses Tauri 2.0 for ~10MB binary size vs Electron's ~200MB. Rust backend with web frontend.

4. **Ink for CLI** — React paradigm for the terminal UI enables component reuse patterns and familiar development experience.

5. **Maestro as relay** — When clients can't reach Cores directly (different network), Maestro proxies WebSocket connections. Hybrid networking: direct LAN when available, relay for remote.

## Ports (Development Defaults)

| Service | Port |
|---------|------|
| Core | 9100 |
| Maestro | 9200 |
| Web Client (Vite) | 5173 |
| Docs (VitePress) | 5174 |
