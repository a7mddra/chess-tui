# Architecture

This document describes how chess-tui works end-to-end. If you're an LLM, agent, or human contributor reading one file to understand the project — this is it.

## System Overview

```
┌─────────────┐    page JS     ┌──────────────┐   chrome.runtime    ┌──────────────┐
│  chess.com   │ ←──────────→  │  page-bridge  │ ←────────────────→  │   content    │
│   (tab)      │  board.move() │  (injected)   │      messages       │   script     │
└─────────────┘               └──────────────┘                     └──────┬───────┘
                                                                          │
                                                                   chrome.runtime
                                                                          │
                                                                   ┌──────▼───────┐
                                                                   │  background  │
                                                                   │  (service    │
                                                                   │   worker)    │
                                                                   └──────┬───────┘
                                                                          │
                                                                     WebSocket
                                                                   ws://127.0.0.1:8765
                                                                          │
                              ┌───────────────────────────────────────────▼──────────┐
                              │                    TUI (Ink/React)                   │
                              │                                                      │
                              │  useOnlineGame ← bridge client ← WebSocket server   │
                              │  useChessBoard ← chess.js + custom generation       │
                              │  useStockfishGame ← stockfish WASM + UCI            │
                              │                                                      │
                              │  GameScreen → Board + InputBox + PlayerInfo          │
                              └─────────────────────────────────────────────────────┘
```

**Reading direction:** chess.com exposes `board.move()` on the page object. Our extension's `page-bridge.ts` is injected into the page and calls this function to make moves. It also scrapes game state (FEN, clocks, usernames, Elo, nationality, board orientation) from the DOM and live game objects. This data flows through the extension's messaging chain to a WebSocket, which the TUI's `OnlineBridge` connects to as a server.

## The Chess.com "Bug"

Chess.com left `board.move()` accessible in the page's JavaScript scope. This function is the same one the browser UI calls when a human drags a piece. By calling it programmatically, we can inject moves that are indistinguishable from human input to chess.com's backend. Chess.com has stated they don't consider this a vulnerability since they have no paid API. But it effectively gives us a free, unofficial API to their entire infrastructure — accounts, Elo, matchmaking, clocks — all without touching any authentication endpoints.

## Monorepo Layout

```
chess-tui/
├── packages/
│   ├── ext/          # Chrome extension (4 files)
│   └── tui/          # Terminal UI (Ink + React)
├── tests/            # Root-level integration tests
├── docs/             # This documentation
│   └── media/        # Logo and demo GIF
├── scripts/          # Build and fixture sanitization scripts
├── SECURITY.md       # Project security policy
└── package.json      # npm workspaces root
```

Both packages use `@chess-tui/` scope. The root `package.json` defines workspace scripts like `dev:tui`, `build:ext`, `tsc:tui`, `tsc:ext`.

## Extension (`packages/ext`)

Four files, flat structure. See [extension.md](./extension.md) for deep dive.

| File             | Role                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page-bridge.ts` | Injected into chess.com page. Calls `board.move()`, scrapes FEN/clocks/players/nationality/board orientation from DOM and game objects. Handles game interactions (resign, draw, new game) through DOM button automation. |
| `content.ts`     | Content script. Relays messages between page-bridge and background via `chrome.runtime`. Handles move timeouts and pending request lifecycle.                                                                             |
| `background.ts`  | Service worker. Connects as WebSocket client to `ws://127.0.0.1:8765` (with fallback to localhost). Routes messages between extension and TUI, emits `game-url`, and requests initial sync on connect.                    |
| `protocol.ts`    | Shared message type definitions, validation functions, and constants.                                                                                                                                                     |

## TUI (`packages/tui`)

React Ink application. Entry point is `src/main.tsx`.

### Directory Map

```
src/
├── main.tsx              # Entry point: renders AppRouter or detached BoardScreen
├── index.ts              # Package exports (WelcomeScreen, GameScreen)
│
├── lib/                  # Shared layer (no React components, only hooks + data + utils)
│   ├── chess/            # Pure chess data
│   │   ├── piece.ts      #   Piece templates, glyphs, movement deltas, power values
│   │   └── types.ts      #   BoardCell, PremoveEntry, UndoSnapshot, etc.
│   ├── api/              # External service integrations
│   │   ├── index.ts      #   Barrel + ApiPlayer type + mock snapshots
│   │   ├── chesscom/     #   Bridge client, snapshot derivation, types
│   │   │   ├── bridge.ts #     WebSocket server (OnlineBridge class) + relay server
│   │   │   ├── core.ts   #     useOnlineGame hook
│   │   │   ├── snapshot.ts#    Derives player info, clocks, material from raw snapshots
│   │   │   └── types.ts  #     BridgeState, GameClockSnapshot, CommandInteraction, etc.
│   │   └── stockfish/    #   Stockfish engine integration
│   │       ├── process.ts#     Spawns WASM binary, manages lifecycle, UCI command queue
│   │       ├── uci.ts    #     UCI protocol line parser
│   │       ├── core.ts   #     useStockfishGame hook
│   │       ├── types.ts  #     Engine state types
│   │       └── index.ts  #     Barrel re-exports
│   ├── config/           # Static configuration
│   │   ├── palette.ts    #   Colors, board themes (HEX values, UI_COLORS, BOARD_THEMES)
│   │   ├── dialogs.ts    #   All dialog messages (howto, draw, win, loss, stockfish, promotion, etc.)
│   │   ├── commands.ts   #   Slash commands by game mode
│   │   ├── shortcuts.ts  #   Keyboard shortcuts (Ctrl+D, Tab, Esc, Ctrl+Z, etc.)
│   │   ├── services.ts   #   External URLs (GitHub, chess.com links)
│   │   └── cmd-search.ts #   Fuzzy command search algorithm (Levenshtein + LCS)
│   ├── platform/         # OS-specific utilities
│   │   ├── open-url.ts   #   xdg-open / open / cmd wrapper
│   │   └── spawn-terminal.ts # Spawns detached board window in OS terminal
│   ├── app-settings.ts   # User preferences persistence (~/.config/chess-tui/preferences.json)
│   └── index.ts          # Barrel file re-exporting everything
│
├── features/             # Smart components (stateful, wired to hooks and data)
│   ├── index.ts          # Barrel: Board, InputBox, PlayerInfo
│   ├── board/
│   │   ├── Board.tsx     #   Board renderer (reads theme, draws 8×8 grid with pieces)
│   │   ├── use-chess-board.ts # THE core hook: chess.js state, premove queue, projected board
│   │   ├── generation.ts #   Speculative move generation for premove hints
│   │   ├── move-utils.ts #   tryMove, tryMoveSwapped, parseCoordinate
│   │   └── board-ipc.ts  #   Unix socket IPC for detached board window
│   ├── input/
│   │   ├── InputBox.tsx  #   Command input with caret, slash commands, move input
│   │   ├── InputCaret.tsx#   Animated blinking cursor
│   │   ├── use-input-handler.ts # Keystroke handling logic
│   │   └── validate.ts  #   Input validation
│   └── players/
│       └── PlayerInfo.tsx#   Player name, Elo, clock, captured pieces display
│
├── components/           # Dumb components (presentational only, no state)
│   ├── HighlightBox.tsx  #   Bordered text box (used for dialog display)
│   ├── SpinnerText.tsx   #   Loading spinner
│   └── DvdBounce.tsx     #   DVD screensaver animation (shown when board is detached)
│
├── screens/
│   ├── WelcomeScreen.tsx  # Mode selection (Online / Stockfish / GitHub / Exit)
│   ├── GameScreen.tsx     # THE main screen (handles all game modes)
│   └── BoardScreen.tsx    # Standalone board display (used by detached window)
│
└── router/
    └── AppRouter.tsx      # Context-based routing between welcome and game screens
```

### Import Rules

**`lib/` is the bottom layer.** Features and screens import from `lib/`, never the reverse.

```
screens/ → features/ → lib/
              ↓
         components/
```

Path alias `@/` maps to `packages/tui/src/`. Most imports go through barrel files (`@/lib`, `@/features`, `@/components`).

## Data Flow: Online Game

1. User opens chess.com in Chrome with extension installed
2. `page-bridge.ts` detects the game board and starts scraping (FEN, clock DOM, player elements, nationality, board orientation)
3. Data flows: page-bridge → content script → background → WebSocket
4. TUI's `OnlineBridge` runs a WebSocket server on port 8765 that the extension connects to; it also runs a relay server on port 8766 for test harnesses
5. `useOnlineGame` hook subscribes to bridge state, derives player info via `snapshot.ts`
6. `GameScreen` renders with live FEN, player names, clocks, Elo
7. User types a move (e.g. `e2e4`) → `InputBox` → promotion check → `useChessBoard.handleUserInput` → validates with chess.js
8. Move sent via `onlineBridge.sendMove(uci)` → WebSocket → background → content → page-bridge → `board.move()`
9. Chess.com processes the move, page updates, extension detects new FEN → cycle repeats
10. Extension also streams `game-url`; TUI derives `gameId` and uses it for `/analyze` review links
11. For game interactions (`/new`, `/resign`, `/draw`, `/accept`, `/decline`), TUI sends `interaction` messages that trigger DOM button clicks in the page-bridge

## Data Flow: Stockfish Game

1. `useStockfishGame` hook spawns the Stockfish WASM binary via `stockfish` npm package
2. Engine communicates via UCI protocol (stdin/stdout text commands)
3. User makes a move → chess.js validates → new FEN
4. When it's the engine's turn, TUI sends `go` command with elo-limited `UCI_LimitStrength`
5. Engine responds with `bestmove e7e5` → `applyUciMoveToFen` → new board state
6. All state is local — no extension or WebSocket involved
7. When playing as Black, the engine makes a weighted opening move automatically

## The Hybrid Board Model

The TUI doesn't fully trust either chess.com or chess.js alone:

- **chess.js** handles: move legality, game termination (checkmate, stalemate, draw), FEN validation, move history
- **Custom generation** (`generation.ts`) handles: speculative premove hints. These show where a piece _could_ move even if it's not your turn, allowing premove queuing
- **chess.com** is the authority for: the actual game state in online mode. When the extension sends a new FEN, `loadFen` reconciles it with local state

The `useChessBoard` hook maintains a **projected board**: the real chess.js board with queued premoves overlaid on top. This is display-only — premoves execute against the real board when it's your turn.

## Detached Board Window

Terminal chess has a font size problem: pieces are tiny compared to normal text. The detached board feature solves this:

1. User presses `Ctrl+D`
2. `spawn-terminal.ts` opens a **new OS terminal window** running `chess-tui --detached-board --session-id=<id>`
3. The main process runs a Unix socket IPC server (`board-ipc.ts`) that broadcasts board state
4. The detached window connects as an IPC client and renders only the board
5. User can resize/zoom the board window independently without breaking the main TUI layout
6. `Ctrl+D` again kills the window and reattaches

## Key Design Decisions

| Decision                                         | Rationale                                                                                                                                    |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| No state management library (Zustand/Redux)      | Component tree is 3 levels deep. Ink re-renders the entire terminal frame anyway. useState + prop drilling is simpler and sufficient.        |
| GameScreen handles all game modes                | It handles chesscom, stockfish, and mock modes in one place. Intentional trade-off — splitting requires careful mode-specific abstraction.   |
| TUI runs the WebSocket server, not the extension | The TUI is the long-lived process. The extension connects as a client and reconnects automatically with exponential backoff.                 |
| Premoves are fully local                         | Can't rely on chess.com's premove system via the bridge (race conditions). Local premove queue with speculative generation is more reliable. |
| chess.js for move validation                     | Battle-tested library. We only use custom code for premove hint generation where chess.js's strict legality is too restrictive.              |
| Board themes in config, not CSS                  | This is a terminal app. "Styling" means ANSI color codes, which are just hex strings in `palette.ts`.                                        |
| Promotion prompt is interactive                  | When a pawn reaches the last rank, an interactive dialog asks for promotion piece instead of defaulting to queen.                            |
