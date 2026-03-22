<p align="center">
  <h1 align="center">NexusCore</h1>
  <p align="center"><strong>Distributed AI Agent Orchestration Platform</strong></p>
  <p align="center">
    Orchestrate AI coding agents across multiple machines. Start a session on your desktop, check progress from your phone, continue from a laptop — all in real-time.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#deployment">Deployment</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#documentation">Docs</a>
</p>

---

## Features

- **Multi-machine orchestration** — Run AI agents on powerful machines, control them from anywhere
- **Real-time collaboration** — File explorer, terminals, git, and chat all update live via WebSocket
- **Built-in IDE experience** — Monaco editor, integrated terminal (xterm.js), git panel with diffs
- **Multiple clients** — Web, Desktop (Tauri), Mobile (React Native), CLI (Ink)
- **Messaging bridge** — WhatsApp and Telegram notifications when agents need human input
- **Secure remote access** — Cloudflare Tunnel integration with zero port forwarding
- **Private repo support** — Clone private GitHub repos via `GITHUB_TOKEN`
- **Docker-ready** — One-command deployment with Docker Compose (dev and production)
- **Pluggable AI** — Anthropic Claude (API key or OAuth), extensible to other providers
- **Skills & MCP** — Equip agents with domain-specific capabilities and tool access

---

## Architecture

NexusCore is built on three layers:

| Layer | Role | Technology |
|-------|------|-----------|
| **Core** | Agent runtime daemon — manages projects, workspaces, agents, terminals, files, git | Node.js, WebSocket, SQLite, node-pty |
| **Maestro** | Orchestration hub — cross-core coordination, message relay, messaging bridge | Node.js, grammy, baileys, SQLite |
| **Clients** | Stateless UIs that connect to Cores for IDE-like experiences | Tauri, React, React Native, Ink |

### Connection Modes

<details>
<summary><strong>Direct Mode</strong> — Single machine, simplest setup</summary>

Clients connect directly to a Core via WebSocket. Best for local development or LAN access.

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

</details>

<details>
<summary><strong>Maestro Mode</strong> — Multi-machine, remote access, messaging</summary>

Clients connect to Maestro, which relays messages to Cores. Enables multi-core orchestration, remote access via Cloudflare Tunnel, and messaging bridges.

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

</details>

<details>
<summary><strong>Docker Mode</strong> — Full stack in containers with optional Cloudflare Tunnel</summary>

All services run in Docker Compose with persistent volumes and optional Cloudflare Tunnel for public access.

```
┌─────────────── Docker Host ───────────────────┐
│                                               │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ Maestro  │  │   Core   │  │ Web (Nginx) │ │
│  │  :9200   │  │  :9100   │  │    :80      │ │
│  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │              │               │        │
│  ┌────▼──────────────▼───────────────▼──────┐ │
│  │          Cloudflare Tunnel (optional)     │ │
│  └──────────────────┬───────────────────────┘ │
└─────────────────────┼─────────────────────────┘
                      │ wss://
            ┌─────────▼──────────┐
            │   Public Internet  │
            │  maestro.domain.com│
            │  nexus.domain.com  │
            └────────────────────┘
```

</details>

---

## Quick Start

### Prerequisites

- **Node.js** >= 22.0.0 and **npm** >= 10.0.0
- **Docker** + **Docker Compose** (optional, for containerized deployment)

### Option 1: Native (Fastest for Development)

```bash
# Clone and install
git clone <repo-url> nexus-core && cd nexus-core
npm install && npm run build

# Start Core + Web Client
npm run dev:core &
npm run dev:web

# Open http://localhost:5173 → Direct Connect → ws://localhost:9100
```

### Option 2: Docker Compose (Recommended for Deployment)

```bash
git clone <repo-url> nexus-core && cd nexus-core

# Configure environment
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY at minimum

# Production (optimized builds, Nginx)
docker compose up -d

# — OR — Development (hot-reload, source mounted)
docker compose -f docker-compose.dev.yml up
```

| Mode | Web Client | Maestro | Core |
|------|-----------|---------|------|
| Production | `http://localhost` | `ws://localhost:9200` | Internal |
| Development | `http://localhost:5173` | `ws://localhost:9200` | `ws://localhost:9100` |

### Configure AI Authentication

Choose one method:

```bash
# Environment variable (recommended for Docker)
ANTHROPIC_API_KEY=sk-ant-xxx

# CLI flag
npm run dev:core -- --api-key sk-ant-xxx

# OAuth — sign in with your Claude Pro/Max plan (opens browser)
npm run dev:core -- --oauth-login
```

Or configure after startup: **Web Client → Settings → Model → Authentication**.

---

## Deployment

### Docker Compose Services

Each service can be started independently:

```bash
docker compose up maestro            # Maestro only
docker compose up core               # Core only (standalone)
docker compose up maestro core       # Maestro + Core
docker compose up                    # All services (Maestro + Core + Web)
docker compose --profile tunnel up   # All + Cloudflare Tunnel
```

**Persistent data** is stored in Docker named volumes:
- `maestro-data` — Maestro database (users, registered cores, settings)
- `core-data` — Core database, cloned repositories, workspaces

These survive `docker compose down`. Only `docker compose down -v` removes them.

### Cloudflare Tunnel (Persistent Public URLs)

Expose NexusCore to the internet with zero port forwarding:

**1. Create a tunnel** in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels

**2. Add public hostname routes** pointing to Docker service names:

| Public Hostname | Service | Type |
|-----------------|---------|------|
| `maestro.yourdomain.com` | `http://maestro:9200` | HTTP |
| `nexus.yourdomain.com` | `http://web:80` | HTTP |

**3. Configure `.env`**:

```env
CF_TUNNEL_TOKEN=eyJ...
VITE_DEFAULT_MAESTRO_URL=wss://maestro.yourdomain.com
```

**4. Start with tunnel profile**:

```bash
docker compose --profile tunnel up -d
```

**Remote Cores** on other machines connect to the tunneled Maestro without Docker:

```bash
NEXUS_MAESTRO_URL="wss://maestro.yourdomain.com" \
NEXUS_MAESTRO_TOKEN="<token-from-maestro>" \
npm run dev:core
```

### Private Repository Access

Set `GITHUB_TOKEN` in `.env` to clone private GitHub repos when adding projects:

```env
GITHUB_TOKEN=ghp_xxxx   # GitHub PAT with `repo` scope
```

The Core automatically injects the token into HTTPS GitHub URLs during cloning.

### Desktop App

A thin Tauri 2.0 shell (~10-15MB) that loads the web client:

```bash
# Requires: Rust toolchain + Tauri prerequisites
# https://v2.tauri.app/start/prerequisites/

npm run dev:web &                            # Start web client first
cd apps/client-desktop && npm run dev        # Tauri dev mode

# Production build → .msi/.exe (Windows), .dmg (macOS), .deb/.AppImage (Linux)
npm run build                                # Bundles web assets into binary
```

---

## Development

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev:core` | Core daemon with hot-reload |
| `npm run dev:maestro` | Maestro service with hot-reload |
| `npm run dev:web` | Web client dev server (port 5173) |
| `npm run dev:desktop` | Desktop client (Tauri) |
| `npm run dev:cli` | CLI client |
| `npm run build` | Build all packages |
| `npm test` | Run all tests |
| `npm run lint` | Lint all packages |
| `npm run typecheck` | Type-check all packages |
| `npm run docker:up` | Docker Compose production |
| `npm run docker:dev` | Docker Compose dev mode |
| `npm run docker:down` | Stop Docker Compose |
| `npm run docker:build` | Build Docker images |
| `npx nx graph` | Visualize dependency graph |
| `npx nx affected -t test` | Test only affected packages |

> `npm run dev:*` automatically builds dependency libraries first via NX.

### Core CLI Options

```bash
npm run dev:core -- --oauth-login          # Authenticate via OAuth (opens browser)
npm run dev:core -- --api-key sk-ant-xxx   # Set API key
npm run dev:core -- --generate-token NAME  # Generate auth token for remote clients
npm run dev:core -- --list-tokens          # List existing auth tokens
npm run dev:core -- --tunnel               # Start with Cloudflare Tunnel
npm run dev:core -- --production           # Production mode (requires auth for all connections)
```

### Monorepo Structure

```
nexus-core/
├── apps/
│   ├── core/                # Core daemon (Node.js, WebSocket, SQLite)
│   ├── maestro/             # Maestro orchestration service
│   ├── client-web/          # Web client (Vite + React)
│   ├── client-desktop/      # Desktop client (Tauri 2.0 shell)
│   ├── client-mobile/       # Mobile client (React Native / Expo)
│   ├── client-cli/          # CLI client (Ink + Commander)
│   └── docs/                # Documentation (VitePress)
├── libs/
│   ├── protocol/            # Shared types & message schemas (foundation)
│   ├── client-shared/       # Shared React hooks/stores
│   ├── client-components/   # Shared UI components (shadcn/ui-style)
│   ├── skills/              # Built-in agent skill definitions
│   └── mcp-configs/         # MCP server configurations
├── docker-compose.yml       # Production deployment
├── docker-compose.dev.yml   # Development with hot-reload
├── Dockerfile               # Multi-stage build (core, maestro, web)
└── .env.example             # Environment variable template
```

### Default Ports

| Service | Port | Docker (Dev) | Docker (Prod) |
|---------|------|-------------|---------------|
| Core | 9100 | 9100 | Internal |
| Maestro | 9200 | 9200 | Internal |
| Web Client | 5173 | 5173 | 80 |
| Docs | 5174 | — | — |

---

## Key Concepts

### Workspaces

An isolated environment within a project — its own agent session, terminals, git branch, and file watchers. Each workspace is cloned to `~/.nexuscore/workspaces/<id>/`. Workspaces follow a state machine: `CREATING → IDLE → ACTIVE → WAITING → SUSPENDED → DESTROYED`.

### Real-time Updates

The file explorer and source control panel update automatically when files change. The Core watches workspace directories and broadcasts events to connected clients — no manual refresh needed.

### Source Control

Built-in Git panel with staging, unstaging, colored diffs in the Monaco editor, and committing with `Ctrl+Enter`.

### Skills

Composable capability packages that equip agents with domain-specific knowledge (TypeScript, React, DevOps, etc.) and tool access.

### MCP Servers

[Model Context Protocol](https://modelcontextprotocol.io/) servers extend agent capabilities with tools for filesystem, git, database, browser, search, and more.

### Messaging Bridge

Maestro integrates with WhatsApp and Telegram for proactive notifications when agents need human input, enabling approval/rejection directly from your phone.

---

## Environment Variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_CORE_HOST` | `127.0.0.1` | Bind host |
| `NEXUS_CORE_PORT` | `9100` | WebSocket port |
| `NEXUS_CORE_NAME` | `NexusCore` | Display name |
| `NEXUS_CORE_ID` | `core-default` | Core identifier |
| `NEXUS_CORE_DB_PATH` | `~/.nexuscore/core.db` | Database file path |
| `NEXUS_CORE_DEV_MODE` | `true` | `false` for production (requires auth) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `GITHUB_TOKEN` | — | GitHub PAT for cloning private repos |
| `NEXUS_CLAUDE_MODEL` | `claude-sonnet-4-5` | Claude model ID |
| `NEXUS_CLAUDE_MAX_TOKENS` | `16000` | Max output tokens |
| `NEXUS_MAESTRO_URL` | — | Maestro WebSocket URL |
| `NEXUS_MAESTRO_TOKEN` | — | Access token for Maestro auth |

### Maestro

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_MAESTRO_HOST` | `0.0.0.0` | Bind host |
| `NEXUS_MAESTRO_PORT` | `9200` | WebSocket port |
| `NEXUS_MAESTRO_DB` | `./maestro.db` | Database file path |
| `NEXUS_MAESTRO_TUNNEL` | `false` | Enable built-in Cloudflare Tunnel |
| `NEXUS_MAESTRO_TUNNEL_MODE` | `quick` | `quick` (temporary) or `named` (persistent) |
| `NEXUS_MAESTRO_TUNNEL_TOKEN` | — | Cloudflare tunnel token |

### Docker / Tunnel

| Variable | Default | Description |
|----------|---------|-------------|
| `CF_TUNNEL_TOKEN` | — | Cloudflare tunnel token (Docker tunnel profile) |
| `VITE_DEFAULT_MAESTRO_URL` | — | Pre-filled Maestro URL in web client login |
| `MAESTRO_PUBLIC_URL` | — | Public Maestro URL (reference only) |
| `WEB_PUBLIC_URL` | — | Public web URL (reference only) |

---

## FAQ

<details>
<summary><strong>How do I connect a Core on another machine?</strong></summary>

Start Maestro with a Cloudflare Tunnel (Docker or native), then on the remote machine:

```bash
NEXUS_MAESTRO_URL="wss://maestro.yourdomain.com" \
NEXUS_MAESTRO_TOKEN="<token>" \
npm run dev:core
```

The Core registers with Maestro and appears in the UI. No Docker required on the remote machine.

</details>

<details>
<summary><strong>Can I run just the Core without Maestro?</strong></summary>

Yes. In Direct Mode, clients connect straight to the Core:

```bash
npm run dev:core    # or: docker compose up core
```

Connect via the web client → "Direct Connect" → `ws://localhost:9100`.

</details>

<details>
<summary><strong>How do I access NexusCore from outside my network?</strong></summary>

Use Cloudflare Tunnel. In Docker: `docker compose --profile tunnel up -d`. Natively: `npm run dev:maestro` with `NEXUS_MAESTRO_TUNNEL=true`. Both give you a public `wss://` URL.

</details>

<details>
<summary><strong>Does restarting containers lose my data?</strong></summary>

No. Maestro and Core data are stored in Docker named volumes (`maestro-data`, `core-data`) that persist across restarts and `docker compose down`. Only `docker compose down -v` removes them. Web client settings are stored in your browser's localStorage.

</details>

<details>
<summary><strong>Can I clone private GitHub repositories?</strong></summary>

Yes. Set `GITHUB_TOKEN` in your `.env` file with a GitHub Personal Access Token that has `repo` scope. The Core injects the token into HTTPS GitHub URLs automatically.

</details>

<details>
<summary><strong>What's the difference between Quick and Named tunnels?</strong></summary>

**Quick tunnels** give you a temporary random URL (e.g., `random-name.trycloudflare.com`) — no Cloudflare account needed, but the URL changes on restart. **Named tunnels** give you persistent custom subdomains (e.g., `maestro.yourdomain.com`) — requires a Cloudflare account and domain.

</details>

<details>
<summary><strong>How does the Desktop app work?</strong></summary>

The desktop app is a thin Tauri 2.0 shell (~10-15MB) that loads the web client. In dev mode it connects to `localhost:5173`; in production it bundles the built web assets. This avoids duplicating the UI and keeps the binary small.

</details>

<details>
<summary><strong>Which AI models are supported?</strong></summary>

Currently Anthropic Claude models via API key or OAuth (Claude Pro/Max plan). The default model is `claude-sonnet-4-5`. Configure via `NEXUS_CLAUDE_MODEL` env var or the web UI settings.

</details>

---

## Documentation

Full architecture document: [`apps/docs/architecture/NexusCore-Architecture-v1.0.md`](apps/docs/architecture/NexusCore-Architecture-v1.0.md)

## License

MIT
