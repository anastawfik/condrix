# NexusCore

## Distributed AI Agent Orchestration Platform

**Architecture Document — Version 1.0 — March 2026**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview & Philosophy](#2-system-overview--philosophy)
3. [Three-Layer Architecture](#3-three-layer-architecture)
4. [Core (Agent Runtime)](#4-core-agent-runtime)
5. [Maestro (Orchestration Layer)](#5-maestro-orchestration-layer)
6. [Client Interfaces](#6-client-interfaces)
7. [Communication Protocol](#7-communication-protocol)
8. [Multi-Machine Networking](#8-multi-machine-networking)
9. [Agent Model & Skills Framework](#9-agent-model--skills-framework)
10. [MCP Server Integration](#10-mcp-server-integration)
11. [Messaging Integrations (WhatsApp/Telegram)](#11-messaging-integrations)
12. [Security & Authentication](#12-security--authentication)
13. [Data Model & Persistence](#13-data-model--persistence)
14. [Technology Stack Recommendations](#14-technology-stack-recommendations)
15. [Development Phases & Roadmap](#15-development-phases--roadmap)
16. [Risk Analysis & Mitigations](#16-risk-analysis--mitigations)
17. [Appendices](#17-appendices)

---

## 1. Executive Summary

NexusCore is a distributed platform for orchestrating AI coding agents across multiple machines, accessible from any device in real-time. It decouples agent runtimes (Cores) from their user interfaces (Clients), enabling developers to start a coding session on a desktop workstation, check progress from a phone, and continue work from a laptop — all without losing context or state.

The platform is built around three foundational pillars:

- **Cores:** Headless agent runtimes that own projects, workspaces, terminals, and AI sessions. They run as persistent daemons on development machines and continue working even when no client is connected.
- **Maestro:** A meta-orchestration agent that maintains awareness of all Cores, all workspaces, and all running agents. It serves as a single conversational interface for managing everything, and proactively reaches out via WhatsApp or Telegram when human input is needed.
- **Clients:** Lightweight, stateless interfaces (CLI, Desktop, Web, Mobile) that connect to Cores in real-time to render IDE-like experiences with chat, file browsing, terminals, and git integration.

This document defines the complete architecture, communication protocols, data models, technology recommendations, and a phased development roadmap.

---

## 2. System Overview & Philosophy

### 2.1 Design Principles

- **Separation of Concerns:** Agent computation is strictly separated from presentation. Cores handle all AI inference, code execution, and state management. Clients are purely rendering and input layers.
- **Device Agnosticism:** A developer should be able to pick up their work from any device. Session state lives in the Core, not the client.
- **Always-On Agents:** Cores run as daemons. Agents continue working on tasks even when the developer disconnects. Results accumulate and are available on reconnection.
- **Orchestration-First:** Maestro is not an afterthought — it is the primary interface for cross-project awareness, and the bridge to messaging platforms.
- **Extensibility:** Skills, MCP servers, and agents are pluggable. The platform ships with sensible defaults inspired by the everything-claude-code collection but allows custom additions.

### 2.2 Conceptual Model

At the highest level, NexusCore can be understood as a hub-and-spoke model where Maestro is the hub and Cores are spokes. Each Core manages one or more Projects, and each Project contains one or more Workspaces. A Workspace is an isolated environment with its own agent session, working directory, terminal processes, and git state.

Clients connect to individual Cores for IDE-like interaction, and to Maestro for cross-cutting orchestration. The key innovation is that both connections are live and bidirectional, enabling real-time streaming of terminal output, chat messages, file changes, and status updates.

---

## 3. Three-Layer Architecture

| Layer | Responsibility | Key Characteristics |
|-------|---------------|---------------------|
| **Core** | Agent runtime, code execution, project/workspace state, terminal management, file system operations | Headless daemon, persistent, runs on dev machines, continues when clients disconnect |
| **Maestro** | Cross-core orchestration, status aggregation, proactive notifications, messaging bridge, agent-to-agent routing | Separate service, subscribes to all Cores, single conversational endpoint, always reachable |
| **Client** | UI rendering, user input capture, real-time display of Core state (chat, files, terminals, git) | Stateless, thin, connects via WebSocket, multiple form factors (CLI/Desktop/Web/Mobile) |

The critical insight is that data flows bidirectionally between Clients and Cores, while Maestro maintains a supervisory connection to all Cores. Clients never talk to each other directly; they synchronize through the Core they are connected to. This makes the Core the single source of truth for workspace state.

---

## 4. Core (Agent Runtime)

The Core is the heart of NexusCore. It is a long-running daemon process that manages the developer's projects, workspaces, AI agents, terminals, and file system interactions. Each development machine runs one Core instance.

### 4.1 Core Responsibilities

- **Project Management:** Register, configure, and manage multiple code repositories/projects.
- **Workspace Lifecycle:** Create, suspend, resume, and destroy workspaces within projects. Each workspace is an isolated agent session with its own working directory.
- **Agent Runtime:** Spawn, manage, and communicate with AI coding agents. Handle context windows, tool calls, and conversation history.
- **Terminal Management:** Create and manage multiple pseudo-terminal (PTY) sessions per workspace. Stream output to connected clients in real-time.
- **File System Operations:** Watch project directories for changes, serve file contents to clients, handle file edits from both agents and users.
- **Git Integration:** Track repository status, staged/unstaged changes, branch information, and diff generation.
- **Client Connection Management:** Accept WebSocket connections from multiple clients simultaneously, synchronize state across all connected clients.
- **Event Emission:** Broadcast workspace events to Maestro for cross-core awareness.

### 4.2 Core Internal Architecture

The Core is structured as a set of managers coordinated by a central runtime:

**Core Runtime (Coordinator)**

The central orchestrator within a Core. It initializes all managers, handles configuration loading, manages the WebSocket server, and routes messages between internal components and external clients/Maestro.

**Project Manager**

Maintains the registry of projects. Each project has a root path, a configuration file (`nexuscore.project.json`), and references to its workspaces. Projects can be added/removed dynamically without restarting the Core.

**Workspace Manager**

Each workspace encapsulates an isolated environment. Internally, a workspace contains a WorkspaceAgent (the AI session), a TerminalPool (managed PTY sessions), a FileWatcher (inotify/fswatch-based), and a GitTracker (periodic polling or file-system event-driven). Workspaces can be suspended to free resources and resumed later with their full state restored from persistence.

**Agent Manager**

Handles the lifecycle of AI agents within workspaces. Responsible for spawning agent processes, managing their context windows, routing tool calls (including MCP server interactions), and handling conversation history. Supports multiple agent backends (Claude, GPT, local models) through a unified AgentProvider interface.

**Connection Manager**

Manages all inbound WebSocket connections. Handles authentication, session tracking, and message routing. When a client connects to a workspace, the Connection Manager subscribes it to that workspace's event stream. Multiple clients can view the same workspace simultaneously with state synchronized via operational transform or last-write-wins conflict resolution.

### 4.3 Core Configuration

Each Core is configured via a `nexuscore.core.json` file in the user's home directory:

```json
{
  "coreId": "core-workstation-01",
  "displayName": "Main Workstation",
  "host": "0.0.0.0",
  "port": 9100,
  "auth": {
    "type": "token",
    "tokenFile": "~/.nexuscore/auth-tokens.json"
  },
  "maestro": {
    "url": "wss://maestro.example.com",
    "registrationToken": "..."
  },
  "projects": [
    { "name": "my-app", "path": "/home/dev/my-app" },
    { "name": "api-service", "path": "/home/dev/api-service" }
  ],
  "defaults": {
    "agentProvider": "claude",
    "model": "claude-sonnet-4-5-20250929",
    "maxWorkspacesPerProject": 5,
    "terminalShell": "/bin/zsh"
  }
}
```

### 4.4 Workspace State Machine

Workspaces follow a well-defined lifecycle:

| State | Description | Transitions |
|-------|-------------|-------------|
| **CREATING** | Workspace being initialized, working directory being set up, worktree being checked out | IDLE on success, ERRORED on failure |
| **IDLE** | Ready and waiting. Agent is loaded but not actively processing. | ACTIVE on user/agent interaction, SUSPENDED on timeout/manual |
| **ACTIVE** | Agent is actively working: processing a prompt, running tools, executing commands. | IDLE on completion, WAITING on human-in-the-loop, ERRORED on failure |
| **WAITING** | Agent needs human input: plan approval, clarifying question, or conflict resolution. | ACTIVE on response, IDLE on cancel |
| **SUSPENDED** | State persisted to disk, resources freed. Can be resumed without data loss. | IDLE on resume |
| **ERRORED** | Unrecoverable error. Logs preserved for debugging. | IDLE on retry, DESTROYED on cleanup |
| **DESTROYED** | Terminal state. Workspace resources cleaned up. | (terminal) |

The WAITING state is critical for Maestro integration. When a workspace enters WAITING, the Core emits a `workspace:waiting` event to Maestro, which can then route the request to the developer via WhatsApp, Telegram, or push notification.

### 4.5 Core API Surface

The Core exposes a WebSocket-based API organized into namespaces. Each namespace groups related operations:

| Namespace | Key Operations | Events Emitted |
|-----------|---------------|----------------|
| **core.\*** | core.info, core.health, core.config.get, core.config.set | core:connected, core:disconnected, core:error |
| **project.\*** | project.list, project.create, project.delete, project.config | project:created, project:deleted, project:updated |
| **workspace.\*** | workspace.create, workspace.list, workspace.enter, workspace.suspend, workspace.resume, workspace.destroy | workspace:created, workspace:stateChanged, workspace:destroyed |
| **agent.\*** | agent.chat, agent.cancel, agent.approve, agent.reject, agent.history | agent:message, agent:toolCall, agent:thinking, agent:waiting, agent:complete |
| **terminal.\*** | terminal.create, terminal.write, terminal.resize, terminal.close, terminal.list | terminal:output, terminal:exit, terminal:created |
| **file.\*** | file.tree, file.read, file.write, file.search, file.watch | file:changed, file:created, file:deleted |
| **git.\*** | git.status, git.diff, git.log, git.stage, git.commit, git.branch | git:statusChanged, git:committed |

---

## 5. Maestro (Orchestration Layer)

Maestro is the brain of NexusCore. It is a standalone service that maintains a live connection to every registered Core, aggregates their state, and serves as the primary conversational interface for cross-cutting concerns. Maestro is what transforms NexusCore from a collection of independent agent runtimes into a unified, intelligent development platform.

### 5.1 Maestro Responsibilities

- **Core Registry:** Maintain a registry of all Cores, their connection status, and their project/workspace inventories.
- **State Aggregation:** Subscribe to events from all Cores to maintain a real-time global view of all workspaces, their states, and their agents.
- **Conversational Interface:** Accept natural language queries about the state of the system. Examples: "What's the status of the API refactor?", "How many agents are currently active?", "Show me everything that's waiting for my input."
- **Proactive Notifications:** When any workspace enters WAITING state (plan approval, question, error), Maestro proactively sends a notification to the developer via their configured channels.
- **Cross-Agent Communication:** Route messages between agents in different workspaces when tasks have dependencies. For example, an API agent can notify a frontend agent that an endpoint schema has changed.
- **Messaging Bridge:** Integrate with WhatsApp and Telegram to enable conversational access to all orchestration capabilities from a phone.
- **Task Delegation:** Accept high-level tasks from the developer and decompose them into sub-tasks that can be dispatched to appropriate workspaces/agents.

### 5.2 Maestro Internal Architecture

**Event Bus**

At Maestro's core is an internal event bus (implemented via an in-process pub/sub or a lightweight message broker like Redis Streams for persistence). Every Core connection feeds events into this bus, and every Maestro subsystem subscribes to relevant event patterns. This decouples event producers from consumers and enables reliable event replay on reconnection.

**State Store**

Maestro maintains an in-memory projection of the global state, backed by a persistent database (SQLite or PostgreSQL). The state store contains: the registry of Cores (ID, display name, host, connection status, last heartbeat), the inventory of all Projects and Workspaces across all Cores, the current state of each workspace (including agent conversation summaries), and a notification queue (pending, sent, acknowledged).

**Conversation Engine**

Maestro itself is powered by an AI agent (using Claude or similar) with a system prompt that gives it awareness of the global state and the ability to issue commands. When a developer asks Maestro a question, the conversation engine queries the state store, formulates a response, and optionally dispatches commands to Cores. The conversation engine has access to tools that can query Core APIs, dispatch tasks, and manage notifications.

**Notification Router**

Responsible for deciding when and how to notify the developer. It monitors the event bus for `workspace:waiting` events, `agent:error` events, and `workspace:complete` events. Based on the developer's notification preferences, it routes to WhatsApp, Telegram, push notification, or all configured channels. Includes deduplication and rate-limiting to prevent notification fatigue.

**Messaging Adapters**

Pluggable adapters for WhatsApp (via Meta Business API or Baileys for personal accounts) and Telegram (via Bot API). Each adapter handles bidirectional message translation: converting developer messages into Maestro commands, and Maestro responses into formatted platform messages.

### 5.3 Maestro Configuration

```json
{
  "maestroId": "maestro-primary",
  "host": "0.0.0.0",
  "port": 9200,
  "database": {
    "type": "sqlite",
    "path": "~/.nexuscore/maestro.db"
  },
  "ai": {
    "provider": "claude",
    "model": "claude-sonnet-4-5-20250929"
  },
  "notifications": {
    "channels": ["whatsapp", "telegram"],
    "quietHours": { "start": "23:00", "end": "07:00" },
    "rateLimitPerHour": 30
  },
  "messaging": {
    "whatsapp": {
      "provider": "baileys",
      "sessionPath": "~/.nexuscore/wa-session"
    },
    "telegram": {
      "botToken": "env:TELEGRAM_BOT_TOKEN"
    }
  }
}
```

### 5.4 Maestro Interaction Examples

To illustrate how Maestro works in practice, here are several interaction scenarios:

**Scenario 1: Status Check via Telegram**

Developer sends a Telegram message: "What's happening across my projects?" Maestro queries its state store, finds 2 active agents (one in the API project doing refactoring, one in the frontend project running tests), 1 workspace in WAITING state (needs approval for a database migration plan), and 3 idle workspaces. It responds with a concise summary and highlights the pending approval, offering inline buttons to approve or reject.

**Scenario 2: Proactive WhatsApp Notification**

An agent working on a complex refactoring task reaches a decision point and needs the developer to choose between two approaches. The workspace enters WAITING state. Maestro detects this event, formats the agent's question with the two options, and sends it via WhatsApp. The developer replies with "Option A". Maestro routes this back to the Core, which feeds it to the agent, and the workspace transitions back to ACTIVE.

**Scenario 3: Cross-Agent Coordination**

The developer tells Maestro: "Once the API agent finishes the auth endpoints, have the frontend agent integrate them." Maestro creates a dependency link in its state store. When the API workspace emits a `workspace:complete` event for the auth task, Maestro automatically dispatches a new task to the frontend workspace with context from the completed API work.

### 5.5 Maestro State Machine

| State | Description | Behavior |
|-------|-------------|----------|
| **INITIALIZING** | Loading state from database, connecting to Cores | Queues incoming requests until ready |
| **ACTIVE** | Fully operational, connected to one or more Cores | Processes all requests, routes notifications |
| **DEGRADED** | One or more Cores are unreachable | Continues with available Cores, marks missing ones, retries connection |
| **RECOVERING** | Reconnecting to a previously lost Core | Replays missed events, reconciles state |

---

## 6. Client Interfaces

Clients are the developer's windows into NexusCore. They are deliberately thin — rendering state received from Cores and sending user input back. No agent logic or project state lives in the client. This design means clients can be replaced, added, or run in parallel without affecting the system.

### 6.1 Client Capabilities Matrix

| Feature | CLI | Desktop | Web | Mobile |
|---------|-----|---------|-----|--------|
| Chat with Agent | ✓ | ✓ | ✓ | ✓ |
| File Tree Browser | ✓ (tree) | ✓ (visual) | ✓ (visual) | ✓ (visual) |
| Code Editor | – (vim/nano) | ✓ (Monaco) | ✓ (Monaco) | ✓ (limited) |
| Terminal Tabs | ✓ (native) | ✓ (xterm.js) | ✓ (xterm.js) | ✓ (basic) |
| Git Diff View | ✓ (text) | ✓ (side-by-side) | ✓ (side-by-side) | ✓ (unified) |
| Multi-Workspace | ✓ (tmux-like) | ✓ (tabs/split) | ✓ (tabs/split) | ✓ (tabs) |
| Maestro Chat | ✓ | ✓ | ✓ | ✓ |
| Notifications | ✓ (stdout) | ✓ (system) | ✓ (browser) | ✓ (push) |
| Offline Viewing | – | ✓ (cached) | – | ✓ (cached) |

### 6.2 Desktop Client

The desktop client is the primary development interface. Built with Tauri (Rust backend, web frontend), it provides a full IDE-like experience. The key panels are:

- **Chat Panel:** Full conversation view with the workspace agent, including message history, streaming responses, tool call visualization, and inline diffs. Supports markdown rendering and code syntax highlighting.
- **File Explorer:** Hierarchical file tree with icons, search, and context menus. Files open in the integrated code editor. Supports drag-and-drop operations.
- **Code Editor:** Monaco-based editor (same engine as VS Code) with full syntax highlighting, IntelliSense-like autocomplete, multi-cursor support, minimap, and diff viewing. Integrated with the Core's file system so saves propagate immediately.
- **Terminal Panel:** Multiple terminal tabs rendered with xterm.js. Each tab connects to a PTY session on the Core. Supports full ANSI rendering, links, and resizing.
- **Git Panel:** Tree of changed files with status indicators (modified, added, deleted, renamed). Clicking a file opens a side-by-side diff view. Supports staging individual files or hunks, committing, and branch switching.
- **Core Switcher:** Sidebar or dropdown showing all registered Cores and their projects. Click to switch. Status indicators show online/offline/degraded state.
- **Maestro Overlay:** A persistent chat window (similar to an assistant sidebar) for interacting with Maestro. Can be pinned or floating.

### 6.3 Mobile Client

The mobile client prioritizes monitoring, chat interaction, and quick actions over full code editing. Built with React Native (sharing UI logic with the web frontend where possible), it provides:

- **Dashboard:** Overview of all Cores, their status, and active workspaces. Uses cards to show workspace state (active, waiting, idle) with quick-action buttons.
- **Chat:** Full chat interface for both workspace agents and Maestro. Supports streaming responses and markdown rendering.
- **File Viewer:** Read-only file browser with syntax highlighting. Quick edit capability for small changes.
- **Terminal:** Basic terminal access for quick commands. Not designed for heavy terminal work but sufficient for monitoring and short interactions.
- **Approval Actions:** When agents are in WAITING state, the mobile client surfaces approval/rejection actions prominently with swipe gestures or prominent buttons.
- **Push Notifications:** Deep-linked notifications that take the developer directly to the workspace or Maestro conversation that needs attention.

### 6.4 Web Client

The web client mirrors the desktop experience running entirely in the browser. It shares the same React component library as the desktop client's webview, making it largely the same codebase. The main difference is that it connects over WSS (WebSocket Secure) through a relay or directly to the Core if the developer is on the same network. The web client enables access from any machine without installing software.

### 6.5 CLI Client

The CLI client is a terminal-based interface inspired by Claude Code and Conductor's terminal mode. Built as a Node.js package installable via npm, it provides a rich TUI (Text User Interface) experience using Ink (React for CLIs) or Blessed. It supports all core operations: chat, file operations, git, and terminal management. The CLI is also scriptable, making it suitable for CI/CD integration and automation.

---

## 7. Communication Protocol

All communication between Cores, Clients, and Maestro uses a unified message protocol over WebSocket connections. This ensures consistent behavior regardless of which client type is used.

### 7.1 Message Envelope

Every message in the system follows a standard envelope format:

```json
{
  "id": "msg_abc123",
  "type": "request | response | event | stream",
  "namespace": "agent",
  "action": "chat",
  "workspaceId": "ws_xyz",
  "payload": { },
  "timestamp": "2026-03-01T12:00:00.000Z",
  "correlationId": "msg_def456"
}
```

- **id:** Unique message identifier (UUID v7 for sortability).
- **type:** `request` (client to Core), `response` (Core to client, correlates to a request), `event` (unsolicited Core-to-client or Core-to-Maestro), `stream` (partial data, part of a larger streaming response).
- **namespace:** API namespace (core, project, workspace, agent, terminal, file, git).
- **action:** Specific operation within the namespace.
- **workspaceId:** Optional. Scopes the message to a specific workspace.
- **correlationId:** For responses and streams, references the originating request ID.

### 7.2 Streaming Protocol

Agent chat responses and terminal output use a streaming protocol. The client sends a request, and the Core responds with multiple `stream` messages followed by a final `response`. Stream messages carry partial content (text chunks for chat, byte arrays for terminal) with sequence numbers for ordering. The final response message carries completion metadata (token counts, duration, etc.).

This design allows clients to render partial results immediately while maintaining the ability to detect dropped messages via sequence gaps. If a client reconnects during a stream, it can request replay from a specific sequence number.

### 7.3 Connection Lifecycle

When a client connects to a Core, the following handshake occurs:

1. **TCP/TLS Handshake:** Standard WebSocket upgrade over HTTPS.
2. **Authentication:** Client sends an auth message with a bearer token. Core validates and responds with the client's authorized scopes.
3. **State Sync:** Core sends a snapshot of the current state for whatever the client subscribes to (workspace list, active workspace state, etc.).
4. **Event Subscription:** Client declares which events it wants to receive (workspace-scoped or global).
5. **Heartbeat:** Both sides send periodic pings to detect connection drops. Configurable interval (default: 15 seconds).

On disconnect, the Core retains the client's subscription state for a configurable window (default: 5 minutes). If the client reconnects within that window, it receives a delta of missed events rather than a full state resync.

---

## 8. Multi-Machine Networking

Supporting multiple Cores across different machines and networks is a key differentiator. The networking layer must handle LAN discovery, WAN access, and secure tunneling.

### 8.1 Network Topology Options

| Topology | Description | Best For |
|----------|-------------|----------|
| **Direct LAN** | Clients connect directly to Cores on the local network. Maestro also on LAN. | Single-location setup, home office, development lab |
| **Tailscale Mesh** | All machines join a Tailscale VPN. Direct peer-to-peer connections even across NAT. | Multi-location, traveling developer, mixed networks |
| **Cloud Relay** | Maestro hosted in cloud acts as a relay. Cores connect outbound to Maestro; clients connect to Maestro. | Maximum accessibility, no network config needed |
| **Hybrid** | LAN direct when available, fallback to relay through Maestro for remote access. | Production recommendation: best of both worlds |

### 8.2 Recommended Approach: Hybrid

The recommended topology is Hybrid. Here is how it works:

- **LAN Discovery:** Cores advertise themselves via mDNS/Bonjour on the local network. Desktop and CLI clients on the same LAN discover and connect directly for lowest latency.
- **Maestro as Registry:** All Cores register with Maestro on startup. Maestro maintains the canonical list of Cores and their connection endpoints (both LAN and WAN addresses).
- **Relay Fallback:** When a client cannot reach a Core directly (different network, mobile client, web client), it routes through Maestro. Maestro proxies the WebSocket connection to the target Core. This adds latency but works from anywhere.
- **Tunnel Option:** For developers who want direct WAN access without relay latency, NexusCore supports integration with Tailscale, Cloudflare Tunnel, or ngrok. The Core's tunnel URL is registered with Maestro as an alternative endpoint.

### 8.3 Core Discovery Protocol

When a client starts, it resolves Cores in this order: (1) Cached cores from previous sessions, (2) mDNS discovery on local network, (3) Query Maestro's registry for all known Cores, (4) Manual entry from configuration. The client pings each discovered Core to determine reachability and latency, preferring direct connections when available.

---

## 9. Agent Model & Skills Framework

NexusCore's agent model defines how AI coding agents are configured, managed, and extended within workspaces. The framework is heavily inspired by the everything-claude-code project's comprehensive approach to defining agent capabilities.

### 9.1 Agent Providers

Agents are accessed through a provider abstraction that normalizes the interface across different AI backends:

| Provider | Backend | Notes |
|----------|---------|-------|
| **claude** | Anthropic API (Claude Opus/Sonnet/Haiku) | Primary recommended provider. Full tool use, extended thinking, streaming. |
| **openai** | OpenAI API (GPT-4o, o1, etc.) | Alternative provider. Function calling via tools API. |
| **local** | Ollama, llama.cpp, vLLM | For privacy-sensitive work or offline use. Limited capabilities. |
| **custom** | Any OpenAI-compatible endpoint | For self-hosted models, proxied APIs, or experimental providers. |

### 9.2 Skills Framework

Skills are pre-defined capability packages that agents can be equipped with. Each skill defines a system prompt fragment, available tools, and configuration. Skills are composable — a workspace can have multiple skills active simultaneously.

**Skill Definition Structure:**

```json
{
  "name": "typescript-expert",
  "version": "1.0.0",
  "description": "Deep TypeScript expertise with type-level programming",
  "systemPromptFile": "./prompts/typescript-expert.md",
  "tools": ["file_read", "file_write", "terminal_exec", "type_check"],
  "mcpServers": ["typescript-language-server"],
  "config": {
    "strictMode": true,
    "targetVersion": "5.4"
  }
}
```

**Built-in Skill Categories:**

- **Language Skills:** TypeScript, Python, Rust, Go, Java — each with language-specific tools, linting integration, and idiomatic code generation.
- **Framework Skills:** React, Next.js, FastAPI, Express, Django — framework-aware agents with knowledge of best practices, project structure, and common patterns.
- **Infrastructure Skills:** Docker, Kubernetes, Terraform, CI/CD — for infrastructure-as-code tasks.
- **Analysis Skills:** Code review, security audit, performance profiling, dependency analysis.
- **Documentation Skills:** README generation, API documentation, architecture decision records.

### 9.3 Agent Lifecycle

Within a workspace, agents follow this lifecycle: Initialization (load skills, build system prompt, establish tool access), Session Start (load conversation history if resuming, or begin fresh), Active Loop (receive messages, think, call tools, generate responses), Suspension (serialize conversation state and tool state to disk), and Resumption (deserialize and continue where left off).

The key design decision is that conversation history and agent state are persisted per-workspace in the Core's database. This enables workspace suspension/resumption and ensures no context is lost if a client disconnects.

---

## 10. MCP Server Integration

Model Context Protocol (MCP) servers extend agent capabilities by providing tools, resources, and prompts through a standardized interface. NexusCore treats MCP servers as first-class citizens.

### 10.1 MCP Server Management

The Core manages MCP server lifecycles. Servers can be defined globally (available to all workspaces), per-project, or per-workspace. The Core handles starting/stopping server processes, health monitoring, and restart on failure.

### 10.2 Pre-configured MCP Servers

Inspired by the everything-claude-code project, NexusCore ships with configurations for a comprehensive set of MCP servers:

- **Filesystem:** Enhanced file operations with search, glob patterns, and atomic writes.
- **Git:** Advanced git operations beyond basic CLI (semantic commit messages, interactive rebase assistance).
- **Database:** PostgreSQL, MySQL, SQLite query execution and schema inspection.
- **Browser:** Puppeteer/Playwright-based web browsing for testing and research.
- **Memory:** Persistent key-value store for agent memory across sessions.
- **Search:** Code search (ripgrep), web search (Brave/Google), and documentation search.
- **Context:** RAG-based retrieval over project documentation and codebase.

### 10.3 MCP Server Discovery

NexusCore includes an MCP server marketplace/registry concept. Developers can browse available servers, install them with a single command, and configure them for their projects. The registry is a JSON catalog that can be hosted locally or pulled from a remote repository.

---

## 11. Messaging Integrations

WhatsApp and Telegram integration through Maestro is a cornerstone feature, enabling developers to interact with their development environment from their phone's primary communication apps.

### 11.1 WhatsApp Integration

**Architecture**

WhatsApp integration uses one of two approaches depending on the developer's needs:

- **Meta Business API (Recommended for production):** Requires a WhatsApp Business Account. Provides official API access with high reliability and delivery guarantees. Supports rich messages (buttons, lists, media). Monthly messaging fees apply.
- **Baileys Library (For personal use):** Open-source library that connects via WhatsApp Web protocol. Free, works with personal WhatsApp accounts. Less reliable long-term (subject to protocol changes). Suitable for personal/development use.

**Message Format**

Messages from Maestro to WhatsApp are formatted for readability in the chat interface. Agent waiting states include action buttons (approve/reject). Status summaries use clean formatting with emoji indicators for workspace states. Code snippets are sent as monospace-formatted text or as document attachments for longer outputs.

### 11.2 Telegram Integration

**Architecture**

Telegram integration uses the official Telegram Bot API, which is free and well-documented. The Maestro Telegram adapter creates a bot that the developer adds to their personal chat or a group.

**Telegram-Specific Features:**

- **Inline Keyboards:** Action buttons (approve, reject, view diff) rendered as inline keyboard buttons below messages.
- **Bot Commands:** `/status`, `/workspaces`, `/approve <id>`, `/reject <id>`, `/chat <workspace> <message>` for quick interactions.
- **File Sharing:** Telegram's generous file size limits (2GB) enable sharing of build artifacts, logs, and even full repository archives.
- **Markdown Support:** Native Markdown rendering for code blocks, bold text, and links.

### 11.3 Unified Messaging Interface

Both messaging adapters implement a common `MessageAdapter` interface:

```typescript
interface MessageAdapter {
  connect(): Promise<void>;
  sendText(chatId: string, text: string): Promise<void>;
  sendRichMessage(chatId: string, msg: RichMessage): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
  disconnect(): Promise<void>;
}
```

This abstraction makes it straightforward to add additional messaging platforms (Discord, Slack, Signal) in the future.

---

## 12. Security & Authentication

Security is critical given that NexusCore provides remote access to development machines with terminal access and file system operations.

### 12.1 AI Authentication (OAuth & API Key)

NexusCore supports two methods for authenticating with AI providers:

#### OAuth (Claude Plan Subscription)

Each Core authenticates independently with Anthropic's Claude service using OAuth tokens from a Claude Pro/Max subscription. This is the recommended method for individual developers.

**Token format:**
- Access token: `sk-ant-oat01-...` (short-lived, ~8 hours)
- Refresh token: `sk-ant-ort01-...` (long-lived, used to obtain new access tokens)
- Stored in: `~/.claude/.credentials.json` on each Core

**Authentication flow:**
1. User initiates sign-in from **Settings → Cores → Sign In icon** in the web client
2. Core spawns `claude auth login` subprocess which generates an OAuth authorization URL
3. User opens the URL in their browser, authenticates with their Claude account
4. Browser shows an auth code — user pastes it back into the NexusCore UI
5. `claude auth login` subprocess exchanges the code for OAuth tokens
6. Tokens are saved to `~/.claude/.credentials.json`

**Why subprocess, not direct API:**
OAuth tokens (`sk-ant-oat01-*`) are scoped to Claude Code's client. Anthropic's backend rejects direct API calls with these tokens for premium models (Sonnet, Opus). NexusCore spawns the `claude` CLI as a subprocess (`claude -p --verbose --output-format stream-json --include-partial-messages`) which handles the API call internally with the correct request shape.

**Token lifecycle:**
- `ClaudeAuthManager` service monitors token expiry every 5 minutes
- Tokens are proactively refreshed 30 minutes before expiry (configurable via `NEXUS_OAUTH_REFRESH_BUFFER_MS`)
- Expired tokens trigger a `core:authExpired` event broadcast to connected clients
- The sidebar shows a red warning icon next to Cores that need re-authentication
- Credentials persist across container restarts via Docker named volumes (`claude-data`)

#### API Key

Standard Anthropic API key (`sk-ant-api-...`) for direct SDK access. Configured via `ANTHROPIC_API_KEY` environment variable or Settings UI. Uses `@anthropic-ai/sdk` directly (no subprocess). Suitable for team/enterprise deployments with API billing.

### 12.2 Core-to-Client Authentication

- **Bearer tokens:** Clients authenticate to Cores using bearer tokens (`nxc_<hex>`). Tokens are generated via CLI (`--generate-token`) or API route (`core:auth.generateToken`).
- **Dev mode:** In development, local (non-tunneled) connections are auto-authenticated with all scopes.
- **Tunnel connections:** Connections detected via `Cf-Connecting-Ip` header always require token auth, even in dev mode.
- **TOTP 2FA (optional):** Tokens can be configured with TOTP (RFC 6238) for additional security. Setup via CLI (`--setup-totp`, `--enable-totp`) or WebSocket routes. When enabled, the `core:auth` handshake requires a `totpCode` field.

### 12.3 Maestro Authentication

- **Core → Maestro:** Cores authenticate using a pre-registered access token sent in the `core:auth` WebSocket message. Maestro validates against its `cores` table.
- **Client → Maestro:** Username/password with optional TOTP. Sessions use `nxm_<hex>` tokens with configurable expiry (default 7 days).
- **Rate limiting:** Login attempts are rate-limited (5 attempts max, 15-minute lockout).
- **Messaging:** WhatsApp and Telegram accounts are linked during setup. Messages only processed from verified chat IDs.

### 12.4 Transport Security

- All remote WebSocket connections should use TLS (WSS). Cloudflare Tunnel provides TLS automatically.
- Core binds to `127.0.0.1` by default — set `NEXUS_CORE_HOST=0.0.0.0` for network access.
- WebSocket max payload: 1 MiB.
- Per-client rate limiting: 50 messages/second.

### 12.5 Authorization

Operations use a scope-based model. Each token carries scopes (`read:files`, `write:files`, `exec:terminal`, `admin:workspace`, `admin:project`, `admin:core`, `chat:agent`, `chat:maestro`). The Core validates scopes on every operation.

---

## 13. Data Model & Persistence

NexusCore uses a layered persistence strategy: hot state in memory, warm state in SQLite, and cold state in the file system.

### 13.1 Core Database (SQLite)

Each Core maintains a local SQLite database with the following primary tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **projects** | Project registry | id, name, path, config, created_at |
| **workspaces** | Workspace registry and state | id, project_id, name, state, branch, worktree_path, config |
| **conversations** | Agent chat history | id, workspace_id, messages (JSON), token_count, created_at |
| **events** | Event log for replay | id, type, workspace_id, payload, sequence, timestamp |
| **agent_state** | Serialized agent state for suspend/resume | workspace_id, state_blob, snapshot_at |

### 13.2 Maestro Database

Maestro's database extends the model with cross-core awareness:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **cores** | Core registry | id, display_name, host, port, status, last_heartbeat |
| **global_workspaces** | Projected view of all workspaces | id, core_id, project_name, state, summary, last_updated |
| **notifications** | Notification queue and history | id, workspace_id, type, status, channel, sent_at, acked_at |
| **task_dependencies** | Cross-workspace task links | id, source_workspace, target_workspace, condition, status |
| **maestro_conversations** | Maestro chat history | id, channel (web/whatsapp/telegram), messages, created_at |

---

## 14. Technology Stack Recommendations

Based on the requirements for real-time communication, cross-platform clients, and AI agent management, the following technology stack is recommended:

### 14.1 Core

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | TypeScript (Node.js) | Ecosystem alignment with Claude Code / Conductor; excellent WebSocket and PTY support; fast iteration. |
| Runtime | Node.js 22+ with native fetch | LTS stability, native ES modules, performance improvements. |
| WebSocket | ws (lightweight) or Socket.IO | ws for minimal overhead; Socket.IO if auto-reconnect, rooms, and namespaces are desired. |
| Terminal | node-pty | Battle-tested PTY management. Powers VS Code terminal. |
| Database | better-sqlite3 | Synchronous SQLite access; no external database dependency; fast for single-writer. |
| File Watching | chokidar or @parcel/watcher | Cross-platform file system watching with debouncing. |
| Git | simple-git + isomorphic-git | simple-git for CLI operations; isomorphic-git for programmatic diff/status. |
| Process Manager | pm2 or systemd (Linux) | Daemon management, auto-restart, log rotation. |

### 14.2 Maestro

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Language | TypeScript (Node.js) | Same as Core for shared types/protocols/tooling. |
| AI Backend | Anthropic SDK (Claude) | Tool use + extended thinking for complex orchestration reasoning. |
| WhatsApp | @whiskeysockets/baileys (personal) or Meta Business API (prod) | Baileys for rapid development; Business API for reliability. |
| Telegram | telegraf or grammy | Modern, TypeScript-native Telegram bot frameworks. |
| Database | better-sqlite3 (local) or PostgreSQL (cloud) | SQLite for single-user; Postgres for team deployments. |
| Event Bus | EventEmitter3 (in-process) or Redis Streams | In-process for simple; Redis for persistence and replay. |

### 14.3 Clients

| Client | Technology | Rationale |
|--------|-----------|-----------|
| Desktop | Tauri 2.0 + React + Monaco Editor | Lighter than Electron (~10MB vs ~200MB); native performance; shared web frontend. |
| Web | React + Vite (same codebase as Desktop webview) | Code reuse with Desktop; fast builds; modern tooling. |
| Mobile | React Native with shared UI library | Maximum code reuse with web; native performance; push notifications. |
| CLI | TypeScript + Ink (React for CLI) | React paradigm for TUI; rich rendering; scriptable. |
| Terminal Renderer | xterm.js | Industry standard; full ANSI support; WebGL rendering. |
| Code Editor | Monaco Editor | VS Code's engine; full IntelliSense; diff views; wide language support. |

### 14.4 Monorepo Structure

```
nexuscore/
  packages/
    core/              # Core daemon
    maestro/           # Maestro orchestration service
    protocol/          # Shared message types and schemas
    client-shared/     # Shared React components/hooks
    client-desktop/    # Tauri desktop app
    client-web/        # Web client (Vite)
    client-mobile/     # React Native app
    client-cli/        # CLI client
    skills/            # Built-in skill definitions
    mcp-configs/       # Pre-configured MCP server definitions
  apps/
    docs/              # Documentation site
```

---

## 15. Development Phases & Roadmap

The roadmap is structured into four phases, each building on the previous one and delivering a usable increment.

### Phase 1: Foundation (Weeks 1–10)

**Goal:** A single Core on one machine with CLI and basic desktop access.

- **Core daemon:** Project/workspace management, agent runtime with Claude provider, terminal management via node-pty, file operations and watching, git status and diff.
- **Protocol:** Define and implement the WebSocket message protocol in the shared protocol package.
- **CLI client:** Full TUI with chat, file tree, terminal, and git views. Installable via npm.
- **Desktop shell:** Tauri app with basic panels (chat, files, terminal). Connect to Core on local network.

**Milestone:** Developer can install Core on their machine, start a workspace, chat with an AI agent, browse files, use the terminal, and see git status — from both CLI and desktop.

### Phase 2: Maestro & Multi-Core (Weeks 11–20)

**Goal:** Maestro service with cross-core orchestration and messaging integration.

- **Maestro service:** Core registry, state aggregation, event bus, conversational AI interface.
- **Multi-Core networking:** LAN discovery, Maestro relay for remote access, Tailscale integration guide.
- **WhatsApp integration:** Baileys-based adapter for personal use, bidirectional messaging.
- **Telegram integration:** Bot API adapter with inline keyboards and commands.
- **Proactive notifications:** Workspace waiting state detection, notification routing, rate limiting.

**Milestone:** Developer can run Cores on multiple machines, ask Maestro about status via Telegram, receive WhatsApp notifications when agents need input, and approve/reject from their phone.

### Phase 3: Rich Client Experience (Weeks 21–30)

**Goal:** Production-quality desktop and web clients with full IDE features.

- **Monaco integration:** Full code editor with syntax highlighting, IntelliSense, multi-cursor, minimap.
- **Git panel:** Side-by-side diff viewer, staging UI, commit interface, branch management.
- **Multi-workspace:** Tab and split-pane management for multiple workspaces simultaneously.
- **Web client:** Deploy the shared frontend as a standalone web app.
- **Skills marketplace:** Browse, install, and configure skills and MCP servers from the UI.

**Milestone:** Desktop and web clients rival Conductor's interface quality. Developer can do a full coding session entirely within NexusCore.

### Phase 4: Mobile & Intelligence (Weeks 31–40)

**Goal:** Mobile client and advanced orchestration features.

- **React Native app:** Dashboard, chat, file viewer, basic terminal, approval actions, push notifications.
- **Cross-agent coordination:** Task dependencies between workspaces, automatic chaining, context sharing.
- **Maestro intelligence:** Task decomposition, automatic workspace creation, learning developer preferences.
- **Meta Business API:** Production WhatsApp integration for reliability.

**Milestone:** Full platform vision realized. Developer can manage their entire AI-assisted development workflow from any device.

---

## 16. Risk Analysis & Mitigations

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| WebSocket scalability | Medium | High connection counts from multiple clients degrade Core | Connection pooling, message batching, lazy event subscription |
| Security exposure | High | Remote terminal access is a high-value attack surface | TLS everywhere, token rotation, scope-based auth, audit logging |
| WhatsApp API instability | Medium | Baileys depends on reverse-engineered protocol | Adapter abstraction; fallback to Telegram; option to upgrade to Business API |
| Monorepo complexity | Low | Build times and dependency conflicts | Turborepo caching, strict package boundaries, CI per-package testing |
| AI provider costs | Medium | Multiple agents running 24/7 can be expensive | Workspace suspension, context summarization, local model fallback for simple tasks |
| State sync conflicts | Medium | Multiple clients editing the same file simultaneously | Last-write-wins with conflict notification; future OT/CRDT support |

---

## 17. Appendices

### A. Glossary

- **Core:** A headless daemon running on a development machine that manages projects, workspaces, and agents.
- **Maestro:** The central orchestration service that coordinates across all Cores and bridges to messaging platforms.
- **Workspace:** An isolated environment within a project with its own agent session, terminals, and git worktree.
- **Skill:** A composable capability package that extends an agent with domain-specific knowledge and tools.
- **MCP Server:** A Model Context Protocol server that provides tools and resources to AI agents.
- **Client:** A UI interface (CLI, Desktop, Web, or Mobile) that connects to a Core to render and interact with workspaces.

### B. Inspirations & References

- **Conductor.build:** Multi-workspace IDE for AI agents. Inspired the workspace model, terminal integration, and overall layout.
- **Claude Remote Control / Worktree:** Inspired the separation of agent runtime from interface and the git worktree per-workspace model.
- **everything-claude-code:** Comprehensive Claude Code configuration. Inspired the skills framework and MCP server catalog.
- **Cursor / Windsurf:** AI-native IDEs. Informed the code editor integration and inline diff approach.

### C. Open Questions

- **Conflict Resolution Strategy:** Should we invest in OT/CRDT for multi-client file editing in Phase 1, or defer to Phase 3 with last-write-wins initially?
- **Licensing Model:** Open source (MIT/Apache), source-available (BSL), or proprietary? Affects community adoption and contribution potential.
- **Team Features:** This architecture is designed for a single developer. Team features (shared workspaces, permission management, team Maestro) are a natural extension but significantly increase scope.
- **Self-hosting vs. Managed:** Should Maestro be offered as a managed cloud service alongside the self-hosted option? This would simplify setup for developers who don't want to manage infrastructure.

---

*End of Architecture Document — NexusCore v1.0 — March 2026*
