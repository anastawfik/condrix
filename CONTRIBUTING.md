# Contributing to Condrix

Thanks for your interest in contributing to Condrix! This guide will help you get started.

## Prerequisites

- **Node.js** >= 22.0.0 and **npm** >= 10.0.0
- **Git** with conventional commit knowledge

## Getting Started

```bash
# Clone the repository
git clone https://github.com/anastawfik/condrix.git
cd condrix

# Install dependencies
npm install

# Build all packages
npm run build

# Start Core + Web Client for development
npm run dev:core &
npm run dev:web
```

## Project Structure

Condrix is an NX monorepo. See [CLAUDE.md](./CLAUDE.md) for detailed architecture, dependency graph, and coding conventions.

| Directory                | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| `apps/core`              | Core daemon — agent runtime, workspaces, terminals, files, git |
| `apps/maestro`           | Maestro — orchestration hub, messaging bridge                  |
| `apps/client-web`        | Web client — Vite + React + shadcn/ui                          |
| `apps/client-desktop`    | Desktop client — Tauri 2.0 shell                               |
| `libs/protocol`          | Shared types, schemas, message definitions                     |
| `libs/client-shared`     | Shared React hooks and Zustand stores                          |
| `libs/client-components` | Shared UI components (shadcn/ui based)                         |

## Development Workflow

### Branching

- `feat/<name>` — New features
- `fix/<name>` — Bug fixes
- `chore/<name>` — Maintenance, dependencies, tooling
- `docs/<name>` — Documentation changes

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add workspace status icons
fix: set subprocess cwd to workspace directory
chore: add husky pre-commit hooks
docs: update README quick start section
refactor: extract content block renderer component
test: add protocol schema validation tests
```

### Pre-commit Hooks

Husky runs automatically on `git commit`:

- **Prettier** formats staged files
- **ESLint** lints staged TypeScript/JavaScript files

### Useful Commands

```bash
npm run dev:core          # Core with hot-reload (port 9100)
npm run dev:web           # Web client dev server (port 5173)
npm run build             # Build all packages
npm test                  # Run all tests
npm run lint              # Lint all packages
npm run typecheck         # Type-check all packages
npx nx affected -t test   # Test only changed packages
npx nx graph              # Visualize dependency graph
```

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes with focused, atomic commits
3. Ensure `npm run build`, `npm run lint`, and `npm test` pass
4. Open a PR against `main` with a clear description
5. CI will run lint, typecheck, test, and build automatically

## Code Style

- **TypeScript strict mode** throughout
- **ESLint 9** flat config + **Prettier** handle formatting
- See [CLAUDE.md](./CLAUDE.md#coding-conventions) for naming conventions, patterns, and architecture decisions

## Architecture Rules

- `@condrix/protocol` is the foundation — all packages depend on it
- Apps never import from other apps — they communicate via WebSocket
- Clients are stateless — all state lives in the Core
- Core and Maestro use the Manager pattern for domain concerns

## Questions?

Open an issue for bugs, feature requests, or questions.
