# Contributing

Start by reading [architecture.md](./architecture.md) — it covers the full system in one document.

## Setup

```bash
git clone https://github.com/a7mddra/chess-tui.git
cd chess-tui
npm install

# Run the TUI in dev mode (no Chrome needed)
npm run dev:tui

# Type-check both packages
npm run tsc:tui
npm run tsc:ext
```

For online mode testing, load `packages/ext/` as an unpacked Chrome extension and open chess.com.

## Codebase Conventions

### TypeScript

- Strict mode enabled
- Path alias `@/` maps to `packages/tui/src/`
- `npm run tsc:tui` and `npm run tsc:ext` must pass with zero errors

### Layer Rules

```
screens/ → features/ → lib/
              ↓
         components/
```

**`lib/` is the bottom layer.** It contains shared data, API integrations, config, and utilities. Features and screens import from `lib/`, but `lib/` must **never** import from `features/`, `screens/`, or `components/`.

### Components

- **`components/`** = dumb, presentational. No hooks that access external state. Only `props` in, JSX out.
- **`features/`** = smart, stateful. These wire data (from hooks, APIs, or state) to UI components.

### Barrel Files

Barrel files (`index.ts`) exist at package boundaries: `@/lib`, `@/features`, `@/components`. Prefer importing from barrels when the export is public. Use direct file imports for internal/private modules.

## Where to Add Things

| What you're adding                  | Where it goes             |
| ----------------------------------- | ------------------------- |
| New chess data types or piece logic | `lib/chess/`              |
| New external API integration        | `lib/api/<provider>/`     |
| New dialog messages                 | `lib/config/dialogs.ts`   |
| New slash commands                  | `lib/config/commands.ts`  |
| New board theme                     | `lib/config/palette.ts`   |
| New keyboard shortcuts              | `lib/config/shortcuts.ts` |
| New dumb UI component               | `components/`             |
| New game feature with state         | `features/<name>/`        |
| New screen                          | `screens/`                |
| OS-specific utility                 | `lib/platform/`           |

## Fixture Handling

Test fixtures from chess.com contain auth tokens. **Always** run `npm run sanitize:fixture` before committing fixture files. See [testing.md](./testing.md) for details.

## Verification

Before submitting changes:

```bash
npm run tsc:tui    # Must pass
npm run tsc:ext    # Must pass
npm run test:tui   # Smoke test the UI (no Chrome needed)
```
