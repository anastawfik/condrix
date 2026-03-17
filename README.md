# NexusCore

**Distributed AI Agent Orchestration Platform**

NexusCore orchestrates AI coding agents across multiple machines, accessible from any device in real-time. Start a coding session on your desktop, check progress from your phone, continue from a laptop — without losing context.

## Architecture

NexusCore is built on three layers:

| Layer | Role | Technology |
|-------|------|-----------|
| **Core** | Agent runtime daemon — manages projects, workspaces, agents, terminals, files, git | Node.js, WebSocket, SQLite, node-pty |
| **Maestro** | Orchestration — cross-core coordination, message relay, messaging bridge | Node.js, grammy, baileys, SQLite |
| **Clients** | Stateless UIs that connect to Cores for IDE-like experiences | Tauri, React, React Native, Ink |

NexusCore supports two connection modes:

### Direct Mode

Clients connect directly to a Core via WebSocket. Best for single-machine setups or LAN access.

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Desktop │     │   Web    │     │  Mobile  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │  WebSocket     │                │
     └───────┬────────┘────────────────┘
             │
    ┌────────▼────────┐
    │      Core       │  ← Agent runtime (1 per machine)
    │  localhost:9100  │
    └─────────────────┘
```

### Maestro Mode

Clients connect to Maestro, which relays messages to Cores. Enables multi-core orchestration, remote access via Cloudflare Tunnel, and messaging bridges (WhatsApp/Telegram).

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Desktop │     │   Web    │     │  Mobile  │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │
     └───────┬────────┘────────────────┘
             │ WebSocket
    ┌────────▼────────┐
    │     Maestro     │  ← Orchestration hub
    │  0.0.0.0:9200   │──── WhatsApp / Telegram
    └───┬─────────┬───┘
        │         │  WebSocket (or Cloudflare Tunnel)
  ┌─────▼───┐ ┌───▼─────┐
  │  Core A │ │  Core B │  ← Cores on different machines
  │ Machine1│ │ Machine2│
  └─────────┘ └─────────┘
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
  client-shared/             # Shared React hooks/stores for clients
  client-components/         # Shared UI components (shadcn/ui-style)
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

# Build all packages (required before first run)
npm run build
```

### Option A: Direct Mode (Single Machine)

The simplest setup — one Core, one Client, same machine.

```bash
# 1. Start the Core daemon
npm run dev:core

# 2. Start the web client
npm run dev:web

# 3. Open http://localhost:5173 in your browser
#    Click "Direct Connect" → connect to ws://localhost:9100
```

**Configure AI authentication** (choose one):

```bash
# API Key — pass via environment variable
ANTHROPIC_API_KEY=sk-ant-xxx npm run dev:core

# API Key — pass via CLI flag
npm run dev:core -- --api-key sk-ant-xxx

# OAuth — sign in with your Claude Pro/Max plan (opens browser)
npm run dev:core -- --oauth-login
```

Or configure after startup via the web client: **Settings → Authentication**.

### Option B: Maestro Mode (Multi-Machine / Remote)

For accessing Cores across machines or networks. Maestro acts as a relay with authentication, Cloudflare Tunnel for remote access, and messaging bridges.

#### Step 1: Start Maestro

On the machine that will act as the orchestration hub:

```bash
# Start Maestro with Cloudflare Tunnel (recommended for remote access)
NEXUS_MAESTRO_TUNNEL=true npm run dev:maestro

# Maestro will output:
#   [Maestro] maestro-primary ready on 0.0.0.0:9200
#   [Maestro] Tunnel URL: wss://random-name.trycloudflare.com
#   [Maestro] Remote Cores can connect with: NEXUS_MAESTRO_URL="wss://..."
```

If `cloudflared` is not installed, Maestro will automatically download it.

**Maestro environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_MAESTRO_HOST` | `0.0.0.0` | Bind host |
| `NEXUS_MAESTRO_PORT` | `9200` | WebSocket port |
| `NEXUS_MAESTRO_TUNNEL` | `false` | Set to `true` to enable Cloudflare Tunnel |
| `NEXUS_MAESTRO_TUNNEL_MODE` | `quick` | `quick` (temporary URL) or `named` (persistent URL) |
| `NEXUS_MAESTRO_TUNNEL_TOKEN` | — | Cloudflare tunnel token (for named tunnels) |
| `NEXUS_MAESTRO_DB` | `./maestro.db` | Database file path |

#### Step 2: Add a Core in Maestro

Open the web client, connect to Maestro (login with the default admin credentials printed at first startup), then add a Core via the Maestro UI. Maestro will generate an **access token** for the Core.

#### Step 3: Start Core(s)

On each machine running a Core, pass the Maestro URL and access token:

```bash
# Using the tunnel URL from Step 1
NEXUS_MAESTRO_URL="wss://random-name.trycloudflare.com" \
NEXUS_MAESTRO_TOKEN="<token-from-maestro>" \
npm run dev:core
```

The Core will connect to Maestro and appear as "online" in the UI.

**Core environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_CORE_HOST` | `127.0.0.1` | Bind host |
| `NEXUS_CORE_PORT` | `9100` | WebSocket port |
| `NEXUS_CORE_NAME` | `NexusCore` | Display name |
| `NEXUS_CORE_ID` | `core-default` | Core identifier |
| `NEXUS_CORE_DB_PATH` | `~/.nexuscore/core.db` | Database file path |
| `NEXUS_CORE_DEV_MODE` | `true` | Set to `false` for production |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `NEXUS_CLAUDE_MODEL` | `claude-sonnet-4-5` | Claude model ID |
| `NEXUS_CLAUDE_MAX_TOKENS` | `16000` | Max output tokens |
| `NEXUS_MAESTRO_URL` | — | Maestro WebSocket URL |
| `NEXUS_MAESTRO_TOKEN` | — | Access token for Maestro authentication |
| `NEXUS_TUNNEL_ENABLED` | `false` | Set to `true` to enable Core tunnel |
| `NEXUS_TUNNEL_MODE` | `quick` | `quick` or `named` |
| `NEXUS_TUNNEL_TOKEN` | — | Cloudflare tunnel token (for named tunnels) |

#### Step 4: Start the Web Client

```bash
npm run dev:web
# Open http://localhost:5173
```

Click **"Maestro"** and enter the Maestro URL (`ws://localhost:9200` if on the same machine, or the tunnel URL for remote). Log in with your credentials, and you'll see all connected Cores.

### Default Ports

| Service | Port |
|---------|------|
| Core | 9100 |
| Maestro | 9200 |
| Web Client (Vite) | 5173 |
| Docs (VitePress) | 5174 |

## Development

```bash
# Run all tests
npm test

# Lint all packages
npm run lint

# Type-check everything
npm run typecheck

# Build/test only affected packages
npx nx affected -t build
npx nx affected -t test

# View the dependency graph
npx nx graph
```

### Dev Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:core` | Core daemon with hot-reload |
| `npm run dev:maestro` | Maestro service with hot-reload |
| `npm run dev:web` | Web client dev server |
| `npm run dev:desktop` | Desktop client (Tauri) |
| `npm run dev:cli` | CLI client |
| `npm run build` | Build all packages |

> **Note:** `npm run dev:*` automatically builds dependency libraries first (via NX).

### Core CLI Commands

```bash
# Authenticate via OAuth (opens browser)
npm run dev:core -- --oauth-login

# Generate an auth token for remote clients
npm run dev:core -- --generate-token <name>

# List existing auth tokens
npm run dev:core -- --list-tokens

# Start with a Cloudflare tunnel
npm run dev:core -- --tunnel

# Start in production mode (requires auth tokens for all connections)
npm run dev:core -- --production
```

## Key Concepts

### Workspaces

A workspace is an isolated environment within a project — its own agent session, terminals, git worktree, and file watchers. Each workspace is cloned to `~/.nexuscore/workspaces/<id>/`. Workspaces follow a state machine: `CREATING → IDLE → ACTIVE → WAITING → SUSPENDED → DESTROYED`.

### Real-time Updates

The Explorer tree and Source Control panel update automatically when files change — no manual refresh needed. The Core watches workspace directories via chokidar and broadcasts `file:changed` events to connected clients.

### Source Control

The built-in Git panel supports:
- Viewing staged and unstaged changes
- Staging and unstaging files
- Viewing colored diffs in the editor (click any file)
- Committing with `Ctrl+Enter`

### Skills

Composable capability packages that equip agents with domain-specific knowledge (TypeScript, React, DevOps, etc.) and tool access.

### MCP Servers

Model Context Protocol servers extend agent capabilities with tools for filesystem, git, database, browser, search, and more.

### Messaging Bridge

Maestro integrates with WhatsApp and Telegram for proactive notifications when agents need human input, enabling approval/rejection directly from your phone.

### Cloudflare Tunnel

Both Core and Maestro support Cloudflare Tunnel for secure remote access without port forwarding:
- **Quick tunnel** — temporary URL, no Cloudflare account needed
- **Named tunnel** — persistent URL, requires a Cloudflare tunnel token

## Documentation

Full architecture document: [`apps/docs/architecture/NexusCore-Architecture-v1.0.md`](apps/docs/architecture/NexusCore-Architecture-v1.0.md)

## License

TBD
