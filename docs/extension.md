# Extension Internals

The Chrome extension bridges chess.com's in-page JavaScript APIs to the TUI via WebSocket. It has 4 source files, all in `packages/ext/src/`.

## The Injection Chain

```
chess.com page
    │
    │ (page-bridge.ts injected as <script>)
    │
    ▼
page-bridge.ts  ──window.postMessage──▶  content.ts  ──chrome.runtime──▶  background.ts
                                                                              │
                                                                         WebSocket client
                                                                         ws://127.0.0.1:8765
                                                                              │
                                                                              ▼
                                                                            TUI
```

Messages flow in both directions. The TUI sends moves and interactions upstream; the extension sends game state downstream.

## File Breakdown

### `page-bridge.ts` (~740 lines, the core)

Injected directly into the chess.com page as a `<script>` element. This is where the "bug" lives — chess.com exposes game objects on the page scope.

**What it reads:**

- FEN string from the game's board controller
- Player usernames, Elo, nationality from DOM elements and internal game objects
- Clock values (both text display and underlying milliseconds)
- Turn indicator (whose clock is ticking)
- Board orientation (which color the user is playing) via CSS class detection
- Game over state and draw offer visibility from DOM elements

**What it writes:**

- Calls `board.move()` with UCI-formatted moves (e.g., `{from: 'e2', to: 'e4'}`)
- This is the same function the browser UI calls when a human drags a piece
- Handles promotion by clicking the promotion piece UI after the move

**Game interactions:**

- `/new` — detects running vs. finished game, resigns if needed, then clicks the new game button
- `/resign` — clicks resign button and auto-confirms
- `/draw` — clicks draw offer button
- `/accept` / `/decline` — clicks draw response buttons

**How it scrapes:**

- Polls the page every 250ms, checking for FEN changes and game events
- Uses DOM selectors to find player info panels (`board-layout-player-top/bottom`), clock elements (`.clock-component`), and country flags
- Accesses internal game objects that chess.com leaves on `window` scope (via `game.getFEN()`, `game.getLegalMoves()`, `game.getPlayers()`)
- Detects the logged-in username from `window.context`, `window.chesscom`, or profile link DOM elements
- Packages everything into `game-state` snapshots with `boardOrientation` sent to the content script
- Detects game over (`.game-over-message-component`) and draw offers (`[data-cy="draw-offer-accept"]`) and emits events

### `content.ts` (~190 lines)

Standard Chrome content script. Acts as a relay with timeout handling:

- Injects `page-bridge.ts` into the page via `chrome.runtime.getURL`
- Responds to `HEALTHCHECK` messages so the background can verify tab readiness
- Handles `APPLY_MOVE` and `APPLY_INTERACTION` commands from background by forwarding to page-bridge via `window.postMessage`
- Manages pending request state with 5-second move timeouts
- Forwards `FEN_UPDATE`, `GAME_OVER`, `DRAW_OFFERED`, `DRAW_CANCELED`, and `BRIDGE_READY` events from page-bridge to background via `chrome.runtime.sendMessage`
- Cleans up pending requests on `beforeunload`

### `background.ts` (~330 lines)

Service worker that acts as a WebSocket client:

- Connects to `ws://127.0.0.1:8765` (with `ws://localhost:8765` fallback, alternating on reconnect)
- Reconnects with exponential backoff (500ms → 1s → 2s → 5s → 10s)
- Routes messages between the TUI (WebSocket) and content scripts (`chrome.runtime`)
- Resolves the best chess.com tab using a priority chain: active tab → previously ready tabs → any chess.com tab, verified via `HEALTHCHECK`
- On connect: emits `game-url` from the active tab URL and triggers a `SYNC_REQUEST` for fresh game state
- Handles `TAB_READY` from content scripts to seed initial game state (FEN + snapshot + URL)
- Tracks tab readiness in a `readyTabIds` set, cleaned up on `tabs.onRemoved`

### `protocol.ts` (~280 lines)

Shared type definitions and validation:

- Message type interfaces for both directions (`WsInboundMessage`, `WsOutboundMessage`)
- Internal message types (`ContentToBackgroundMessage`, `ApplyMoveCommand`, `ApplyInteractionCommand`)
- `CommandInteraction` type: `"new" | "resign" | "draw" | "accept" | "decline"`
- `PlayerClockSnapshot` with `nationality` and `placement` fields
- `GameClockSnapshot` with optional `boardOrientation` (`"w" | "b"`)
- Runtime validation functions (`parseWsInbound`, `isContentToBackgroundMessage`, `isGameClockSnapshot`, etc.)
- Constants (UCI regex)

## Security Boundary

The extension reads only what's visible on the page (game state, public player info). It does **not** access:

- Cookies or session tokens
- Account passwords
- Payment or subscription data
- Any chrome.storage or localStorage

The only write operations are `board.move()` (mimics a human drag-and-drop) and DOM button clicks for game interactions (resign, draw, new game).

## Development

```bash
# Build the extension
npm run build:ext

# Type-check
npm run tsc:ext
```

To test: load the `packages/ext/` directory as an unpacked extension in `chrome://extensions`, navigate to chess.com, and start a game. The extension auto-activates on chess.com pages.
