# CLI TUI Design — Condrix

> Architecture-level design document for `@condrix/client-cli`, the terminal-based user interface.

## Motivation

The CLI client connects to **remote** Core daemons via WebSocket. Because the Core may run on a different machine (Docker, cloud, LAN server), local tools like `ls`, `vim`, and `git` operate on the wrong filesystem. The TUI must therefore provide its own panels for file browsing, editing, terminal access, and git — all proxied through the Core's WebSocket protocol.

## Layout

tmux-like panel system with resizable, collapsible regions:

```
+------------------------------------------------------------------+
| [Condrix] core-01 | ws: my-app/feature-auth | ACTIVE           | Status Bar
+------------------------------------------------------------------+
|                     |                                             |
|  FILE TREE          |  MAIN PANEL (Chat / File Viewer / Git)     |
|  (collapsible)      |                                             |
|  src/               |  [Chat] [file.ts] [git]    <- tab bar      |
|    index.ts         |                                             |
|    App.tsx          |  User: Fix the login bug                    |
|    utils/           |  Assistant: I'll look at...                 |
|                     |                                             |
+------------------------------------------------------------------+
|  TERMINAL (collapsible)                                           |
|  $ npm run build                                                  |
+------------------------------------------------------------------+
| F2:Files F3:Chat F4:Term F5:Git  Tab:Cycle  ^L:Layout  ^Q:Quit  | Keybind Bar
+------------------------------------------------------------------+
```

### Layout Modes

| Mode               | Description                                       |
| ------------------ | ------------------------------------------------- |
| **Single**         | Main panel only (chat or file viewer, full width) |
| **Split-Vertical** | Sidebar (file tree) + Main panel                  |
| **Three-Way**      | Sidebar + Main panel + Terminal (bottom)          |

Cycle layouts with `Ctrl+L`. Each panel is independently collapsible.

## Keyboard Navigation

| Key          | Action                                     |
| ------------ | ------------------------------------------ |
| `F2`         | Focus file tree panel                      |
| `F3`         | Focus chat panel                           |
| `F4`         | Focus terminal panel                       |
| `F5`         | Focus git panel                            |
| `Tab`        | Cycle focus between visible panels         |
| `Ctrl+L`     | Cycle layout mode                          |
| `Ctrl+Q`     | Quit                                       |
| `Arrow keys` | Navigate within focused panel              |
| `Enter`      | Select / expand in file tree; send in chat |
| `Ctrl+Enter` | Newline in chat input                      |
| `/`          | Quick search within focused panel          |
| `Ctrl+P`     | Quick-open file by name                    |

## Panels

### Chat Panel

- Scrollable message history with markdown rendering
- User messages (right-aligned) and assistant messages (left-aligned)
- Inline tool call blocks: collapsible, show tool name + status (pending/approved/rejected/done)
- Approve/reject prompts for agent actions (Y/N keys when focused)
- Streaming indicator (blinking cursor) during assistant response
- Input area at bottom: multi-line, `Enter` sends, `Ctrl+Enter` for newline

**Protocol:** `agent:chat` request, subscribe to `agent:message`, `agent:toolCall`, `agent:thinking`, `agent:waiting`, `agent:complete` events. Load history via `agent:history` on mount.

### File Tree Panel

- Hierarchical directory listing with expand/collapse
- Lazy-load children on expand via `file:tree` requests
- File type icons (directory, file, by extension)
- Click/Enter opens file in main panel (read-only viewer)
- Search/filter bar at top
- Live updates via `file:changed`, `file:created`, `file:deleted` events

**Protocol:** `file:tree` (depth=1 per expand), `file:read` (on open), subscribe to file events.

### File Viewer

- Syntax-highlighted, read-only file display (via `cli-highlight`)
- Line numbers
- Search within file (`/` key)
- Opens as tabs in the main panel alongside Chat
- Dirty indicator if file changes externally

**Protocol:** `file:read` to load content. Subscribe to `file:changed` to detect external edits.

### Terminal Panel

- Full remote PTY via Core's terminal manager
- Multiple terminal tabs (create with `+`, close with `x`)
- Input forwarded via `terminal:write`, output received via `terminal:output` events
- Resize events sent on panel resize via `terminal:resize`
- Auto-closes tab on `terminal:exit` event

**Protocol:** `terminal:create` → get `terminalId` → subscribe to `terminal:output` → `terminal:write` for input → `terminal:resize` on dimensions change.

### Git Panel

- Current branch and status summary
- Staged and unstaged file lists with M/A/D/R/? status indicators
- Stage/unstage individual files or all
- Inline diff viewer for selected file
- Commit input with message field

**Protocol:** `git:status`, `git:diff`, `git:stage`, `git:commit`. Subscribe to `git:statusChanged`, `git:committed`.

## Component Architecture

```
condrix (CLI binary)
  └─ CondrixCli (root Ink component)
       ├─ CoreConnectionProvider (WebSocket + auth context)
       │    └─ WorkspaceProvider (active workspace context)
       │         └─ Layout
       │              ├─ StatusBar
       │              ├─ Sidebar
       │              │    ├─ FileTreePanel
       │              │    └─ GitPanel
       │              ├─ MainPanel
       │              │    ├─ TabBar
       │              │    ├─ ChatPanel
       │              │    └─ FileViewer
       │              ├─ TerminalPanel
       │              └─ KeybindBar
       └─ ConnectionDialog (shown when disconnected)
```

## Technology

| Library            | Purpose                                                  |
| ------------------ | -------------------------------------------------------- |
| **Ink 5**          | React renderer for terminals (flexbox layout engine)     |
| **React 19**       | Component model, hooks, context                          |
| **Commander**      | CLI argument parsing (`condrix connect`, `condrix exec`) |
| **ink-text-input** | Text input components                                    |
| **cli-highlight**  | Syntax highlighting for file viewer                      |
| **cli-spinners**   | Loading/streaming indicators                             |

## CLI Commands

### Interactive (TUI)

```bash
# Connect to a Core and launch TUI
condrix connect -u ws://host:9100 -t <token>

# Connect with saved profile
condrix connect --profile my-server
```

### Scriptable (non-interactive, for CI/CD)

```bash
# Run a command in a workspace
condrix exec --url ws://host:9100 --token <token> --workspace ws_123 --command "npm test"

# Send a chat message and print response
condrix chat --url ws://host:9100 --token <token> --workspace ws_123 "Fix the login bug"

# Get workspace status
condrix status --url ws://host:9100 --token <token>
```

### Profile Management

```bash
# Save a Core connection profile
condrix profile add my-server --url ws://192.168.1.100:9100 --token <token>

# List saved profiles
condrix profile list

# Remove a profile
condrix profile remove my-server
```

## Connection Flow

1. User runs `condrix connect -u ws://host:9100 -t <token>`
2. CLI establishes WebSocket connection to Core
3. Sends `core:auth` with token → receives scopes
4. Sends `core:info` → displays Core name and status in Status Bar
5. Fetches project list → user selects project and workspace (or creates new)
6. Subscribes to relevant events (`agent:*`, `terminal:*`, `file:*`, `git:*`, `workspace:*`)
7. TUI renders with workspace context loaded

## Considerations

- **Bandwidth:** Terminal output and file content can be large. The TUI should buffer intelligently and truncate very long outputs.
- **Latency:** Remote connections add latency. All panels should show loading states and handle slow responses gracefully.
- **Terminal size:** Ink measures terminal dimensions. Layout adapts to available columns/rows, collapsing panels if terminal is too narrow.
- **Color support:** Detect terminal color capabilities (16/256/truecolor) and degrade gracefully.
- **Screen readers:** Ink supports accessible text output; ensure meaningful alt text for status indicators.
