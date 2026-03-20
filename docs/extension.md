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
                                                                         WebSocket server
                                                                         ws://127.0.0.1:8765
                                                                              │
                                                                              ▼
                                                                            TUI
```

Messages flow in both directions. The TUI sends moves upstream; the extension sends game state downstream.

## File Breakdown

### `page-bridge.ts` (~400 lines, the core)

Injected directly into the chess.com page as a `<script>` element. This is where the "bug" lives — chess.com exposes game objects on the page scope.

**What it reads:**
- FEN string from the game's board controller
- Player usernames, elo, nationality from DOM elements
- Clock values (both text display and underlying milliseconds)
- Turn indicator (whose clock is ticking)
- Board orientation (which color the user is playing)

**What it writes:**
- Calls `board.move()` with UCI-formatted moves (e.g., `{from: 'e2', to: 'e4'}`)
- This is the same function the browser UI calls when a human drags a piece

**How it scrapes:**
- Polls the page at intervals, looking for game board elements
- Uses DOM selectors to find player info panels, clock elements
- Accesses internal game objects that chess.com leaves on `window` scope
- Packages everything into `game-state` snapshots sent to the content script

### `content.ts` (~100 lines)

Standard Chrome content script. Acts as a relay:
- Injects `page-bridge.ts` into the page
- Forwards `window.postMessage` events from page-bridge → `chrome.runtime.sendMessage` to background
- Forwards `chrome.runtime.onMessage` from background → `window.postMessage` to page-bridge

### `background.ts` (~170 lines)

Service worker that runs the WebSocket server:
- Listens on `ws://127.0.0.1:8765`
- Routes messages between the TUI (WebSocket client) and content scripts (chrome.runtime)
- Handles connection/disconnection lifecycle
- Sends `status` messages when the extension connects or disconnects
- On connect, resolves the active Chess.com tab and emits `game-url` to seed TUI state
- Triggers a `SYNC_REQUEST` to immediately fetch fresh game state after reconnect

### `protocol.ts` (~130 lines)

Shared type definitions:
- Message type enums (`ping`, `pong`, `move`, `move-result`, `fen`, `game-state`, `status`, `error`, `game-over`, `draw-offered`, `draw-canceled`, `game-url`)
- Type interfaces for each message shape
- Constants (WebSocket URL, timeouts)

## Recent behavior updates

- Draw offer lifecycle now has both edges: `DRAW_OFFERED` and `DRAW_CANCELED`.
- The first bridge handshake now includes the current tab URL (`game-url`), so TUI can derive `gameId` immediately.
- This `gameId` is consumed by `/analyze` to open the correct review URL.

## Security Boundary

The extension reads only what's visible on the page (game state, public player info). It does **not** access:
- Cookies or session tokens
- Account passwords
- Payment or subscription data
- Any chrome.storage or localStorage

The only write operation is `board.move()`, which mimics a human drag-and-drop action.

## Development

```bash
# Build the extension
npm run build:ext

# Type-check
npm run tsc:ext
```

To test: load the `packages/ext/` directory as an unpacked extension in `chrome://extensions`, navigate to chess.com, and start a game. The extension auto-activates on chess.com pages.
