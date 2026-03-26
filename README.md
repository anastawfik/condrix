<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="apps/client-web/public/logo.png">
    <img src="apps/client-web/public/logo.png" alt="Condrix" width="320">
  </picture>
</p>
<p align="center"><strong>Distributed AI Agent Orchestration Platform</strong></p>
<p align="center">
  Orchestrate AI coding agents across multiple machines. Start a session on your desktop, check progress from your phone, continue from a laptop — all in real-time.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#authentication">Authentication</a> &bull;
  <a href="#deployment">Deployment</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#roadmap">Roadmap</a> &bull;
  <a href="#documentation">Docs</a>
</p>

---

> **Early Development Notice**
>
> Condrix is under **active, heavy development**. The architecture, APIs, database schemas, and configuration formats may change without notice between commits. This is a pre-release project — expect breaking changes, incomplete features, and rough edges.
>
> **What works today:**
> - Core daemon with full workspace, terminal, file, and git management
> - Web client with IDE-like interface (Monaco editor, xterm.js, git panel)
> - AI chat via Claude (OAuth/Claude Plan or API key)
> - Maestro orchestration with multi-core relay
> - Docker deployment with Cloudflare Tunnel
> - Per-Core OAuth authentication via UI
>
> **What's still in progress:** See [Roadmap](#roadmap) below.
>
> Bug reports, and feedback are welcome!

---

## Features

- **Multi-machine orchestration** — Run AI agents on powerful machines, control them from anywhere
- **Real-time collaboration** — File explorer, terminals, git, and chat all update live via WebSocket
- **Built-in IDE experience** — Monaco editor, integrated terminal (xterm.js), git panel with diffs
- **Multiple clients** — Web, Desktop (Tauri), Mobile (React Native), CLI (Ink)
- **Messaging bridge** — WhatsApp and Telegram notifications when agents need human input
- **Secure remote access** — Cloudflare Tunnel integration with zero port forwarding
- **Per-Core authentication** — Each Core authenticates independently via OAuth or API key, with auto-refresh and UI-based sign-in flow
- **Docker-ready** — One-command deployment with Docker Compose (dev and production)
- **Pluggable AI** — Anthropic Claude (via Claude Code subprocess for OAuth, or direct SDK for API keys)
- **Skills & MCP** — Equip agents with domain-specific capabilities and tool access

---

## Architecture

Condrix is built on three layers:

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
            │  condrix.domain.com  │
            └────────────────────┘
```

</details>

---

## Authentication

Condrix supports two authentication methods for AI access:

### OAuth (Claude Plan — Recommended)

Uses your Claude Pro/Max subscription via the Claude Code CLI subprocess. **Each Core authenticates independently.**

**How it works:**
1. Open **Settings → Cores** in the web client
2. Click the **Sign In** icon (🔑) next to a connected Core
3. Click **Start Authentication** → browser opens Claude's auth page
4. Sign in and copy the auth code shown on the success page
5. Paste the code back in the Condrix UI → click **Submit**
6. Done — the Core can now use all Claude models (Haiku, Sonnet, Opus)

**Token lifecycle:**
- Tokens are stored in `~/.claude/.credentials.json` on each Core
- The `ClaudeAuthManager` service monitors token expiry every 5 minutes
- Tokens are auto-refreshed 30 minutes before expiry
- A red warning icon appears in the sidebar if a Core needs re-authentication
- Credentials persist across container restarts via Docker named volumes (`claude-data`)

**How OAuth calls work:**
- OAuth tokens are scoped to Claude Code — they cannot be used directly with the Anthropic API for premium models (Sonnet/Opus)
- Condrix spawns a `claude` CLI subprocess (from the installed Claude Code package) which handles the API call internally
- Streaming responses are parsed from the subprocess's NDJSON output

**Requirements:**
- Claude Code CLI must be installed on each Core host (included in Docker images via `@anthropic-ai/claude-code`)
- A Claude Pro or Max subscription

### API Key

Uses a standard Anthropic API key for direct SDK access.

```bash
# Environment variable
ANTHROPIC_API_KEY=sk-ant-xxx

# CLI flag
npm run dev:core -- --api-key sk-ant-xxx
```

Or configure via **Settings → AI** in the web client.

**Note:** API key auth uses the `@anthropic-ai/sdk` directly (no subprocess). Extended thinking is not available for 4.6 models via API key — use OAuth for full model capabilities.

### Core Terminal

Each Core has a remote terminal accessible from **Settings → Cores → Terminal icon** (⬛). This opens a root shell on the Core where you can run admin commands:

```bash
claude auth login          # Authenticate (alternative to UI flow)
claude auth status --text  # Check current auth state
```

---

## Quick Start

### Prerequisites

- **Node.js** >= 22.0.0 and **npm** >= 10.0.0
- **Docker** + **Docker Compose** (optional, for containerized deployment)

### Option 1: Native (Fastest for Development)

```bash
# Clone and install
git clone https://github.com/anastawfik/condrix.git && cd condrix
npm install && npm run build

# Start Core + Web Client
npm run dev:core &
npm run dev:web

# Open http://localhost:5173 → Direct Connect → ws://localhost:9100
```

### Option 2: Docker Compose (Recommended for Deployment)

```bash
git clone https://github.com/anastawfik/condrix.git && cd condrix

# Configure environment
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY or use OAuth after startup

# Production (optimized builds, Nginx)
docker compose up -d

# — OR — Development (hot-reload, source mounted)
docker compose -f docker-compose.dev.yml up
```

| Mode | Web Client | Maestro | Core |
|------|-----------|---------|------|
| Production | `http://localhost` | `ws://localhost:9200` | Internal |
| Development | `http://localhost:5173` | `ws://localhost:9200` | `ws://localhost:9100` |

After startup, authenticate each Core via the web UI: **Settings → Cores → Sign In icon**.

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
- `claude-data` — Claude Code credentials (OAuth tokens)

These survive `docker compose down`. Only `docker compose down -v` removes them.

### Cloudflare Tunnel (Persistent Public URLs)

Expose Condrix to the internet with zero port forwarding:

**1. Create a tunnel** in [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → Networks → Tunnels

**2. Add public hostname routes** pointing to Docker service names:

| Public Hostname | Service | Type |
|-----------------|---------|------|
| `maestro.yourdomain.com` | `http://maestro:9200` | HTTP |
| `condrix.yourdomain.com` | `http://web:80` | HTTP |

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
CONDRIX_MAESTRO_URL="wss://maestro.yourdomain.com" \
CONDRIX_MAESTRO_TOKEN="<token-from-maestro>" \
npm run dev:core
```

### Private Repository Access

Set `GITHUB_TOKEN` in `.env` to clone private GitHub repos when adding projects:

```env
GITHUB_TOKEN=ghp_xxxx   # GitHub PAT with `repo` scope
```

### Desktop App

A thin Tauri 2.0 shell (~10-15MB) that loads the web client:

```bash
# Requires: Rust toolchain + Tauri prerequisites
# https://v2.tauri.app/start/prerequisites/
npm run dev:web &
cd apps/client-desktop && npm run dev
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
| `npx nx graph` | Visualize dependency graph |

### Monorepo Structure

```
condrix/
├── apps/
│   ├── core/                # Core daemon (Node.js, WebSocket, SQLite)
│   ├── maestro/             # Maestro orchestration service
│   ├── client-web/          # Web client (Vite + React + shadcn/ui)
│   ├── client-desktop/      # Desktop client (Tauri 2.0 shell)
│   ├── client-mobile/       # Mobile client (React Native / Expo)
│   ├── client-cli/          # CLI client (Ink + Commander)
│   └── docs/                # Documentation (VitePress)
├── libs/
│   ├── protocol/            # Shared types & message schemas (foundation)
│   ├── client-shared/       # Shared React hooks/stores
│   ├── client-components/   # Shared UI components
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

---

## Key Concepts

### Workspaces

An isolated environment within a project — its own agent session, terminals, git branch, and file watchers. Each workspace is cloned to `~/.condrix/workspaces/<id>/`. Workspaces follow a state machine: `CREATING → IDLE → ACTIVE → WAITING → SUSPENDED → DESTROYED`.

### Real-time Updates

The file explorer and source control panel update automatically when files change. The Core watches workspace directories and broadcasts events to connected clients.

### Source Control

Built-in Git panel with staging, unstaging, colored diffs in the Monaco editor, and committing with `Ctrl+Enter`.

### Skills & MCP

Composable capability packages that equip agents with domain-specific knowledge. [MCP servers](https://modelcontextprotocol.io/) extend capabilities with filesystem, git, database, browser, and search tools.

### Messaging Bridge

Maestro integrates with WhatsApp and Telegram for proactive notifications when agents need human input.

---

## Roadmap

### Milestone 1: Core Platform (Current)
- [x] Core daemon with workspace, terminal, file, git management
- [x] Web client with IDE-like interface (Monaco, xterm.js, git panel)
- [x] Maestro orchestration with multi-core relay
- [x] OAuth authentication (Claude Plan) via Claude Code subprocess
- [x] Per-Core auth with UI sign-in flow and auto-refresh
- [x] Docker deployment with Cloudflare Tunnel
- [x] shadcn/ui component migration (in progress)
- [x] Production hardening (rate limiting, structured logging, DB indices)
- [ ] Complete shadcn/ui migration (replace all old CSS variables)
- [ ] Vitest unit tests for protocol schemas and Core managers
- [ ] E2E tests with Playwright

### Milestone 2: Desktop & CLI Clients
- [ ] Desktop client (Tauri wrapper for web client)
- [ ] CLI client with Ink components (chat, file ops, terminal, git)
- [ ] Desktop-specific features (system tray, native notifications)

### Milestone 3: Mobile Client
- [ ] React Native (Expo) mobile app
- [ ] Core browsing, workspace management, chat
- [ ] Push notifications for workspace events

### Milestone 4: Advanced Orchestration
- [ ] ConversationEngine — AI-powered Maestro natural language queries
- [ ] NotificationRouter — WhatsApp/Telegram message adapters
- [ ] Cross-agent communication (route messages between workspaces)
- [ ] MCP server marketplace/discovery
- [ ] Session-per-workspace for multi-turn context in Claude subprocess

### Milestone 5: Security & Enterprise
- [ ] TOTP 2FA for Core WebSocket connections
- [ ] Bidirectional Core↔Maestro connections (outbound via tunnel)
- [ ] Role-based access control (RBAC)
- [ ] Audit logging
- [ ] TLS enforcement in production mode
- [ ] PostgreSQL support for team deployments

---

## Environment Variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `CONDRIX_CORE_HOST` | `127.0.0.1` | Bind host |
| `CONDRIX_CORE_PORT` | `9100` | WebSocket port |
| `CONDRIX_CORE_NAME` | `Condrix` | Display name |
| `CONDRIX_CORE_ID` | `core-default` | Core identifier |
| `CONDRIX_CORE_DB_PATH` | `~/.condrix/core.db` | Database file path |
| `CONDRIX_CORE_DEV_MODE` | `true` | `false` for production |
| `CONDRIX_CORE_CONTAINER` | — | Set `true` when running in Docker |
| `CONDRIX_CORE_EXTERNAL_URL` | — | Public URL for OAuth callback (tunnel URL) |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (alternative to OAuth) |
| `GITHUB_TOKEN` | — | GitHub PAT for cloning private repos |
| `CONDRIX_CLAUDE_MODEL` | `claude-sonnet-4-5` | Default Claude model |
| `CONDRIX_MAESTRO_URL` | — | Maestro WebSocket URL (for Core→Maestro connection) |
| `CONDRIX_MAESTRO_TOKEN` | — | Access token for Maestro auth |
| `CONDRIX_HOST_MOUNTS` | — | Host folder mounts for containerized Cores (e.g., `Projects=/host/projects`) |

### Maestro

| Variable | Default | Description |
|----------|---------|-------------|
| `CONDRIX_MAESTRO_HOST` | `0.0.0.0` | Bind host |
| `CONDRIX_MAESTRO_PORT` | `9200` | WebSocket port |
| `CONDRIX_MAESTRO_DB` | `~/.condrix/maestro.db` | Database file path |
| `CONDRIX_MAESTRO_TUNNEL` | `false` | Enable built-in Cloudflare Tunnel |
| `CONDRIX_MAESTRO_TUNNEL_MODE` | `quick` | `quick` or `named` |
| `CONDRIX_MAESTRO_TUNNEL_TOKEN` | — | Cloudflare tunnel token |

### Docker / Tunnel

| Variable | Default | Description |
|----------|---------|-------------|
| `CF_TUNNEL_TOKEN` | — | Cloudflare tunnel token (Docker tunnel profile) |
| `VITE_DEFAULT_MAESTRO_URL` | — | Pre-filled Maestro URL in web client |

---

## Documentation

Full architecture document: [`apps/docs/architecture/Condrix-Architecture-v1.0.md`](apps/docs/architecture/Condrix-Architecture-v1.0.md)

## License

MIT
