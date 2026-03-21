# Roadmap

## Current State

chess-tui is feature-complete for core gameplay:

- **Online mode** — play chess.com from terminal, full end-to-end (move injection, FEN streaming, live clocks, player info, Elo, nationality, board orientation)
- **Offline mode** — play against Stockfish with adjustable Elo (100–3000), weighted opening book for engine-as-Black
- **Bridge protocol v0** — stable WebSocket contract between extension and TUI, with `interaction` messages for resign/draw/new game
- **Premove system** — fully local, with speculative move generation and queue chaining
- **Board themes** — 4 themes (Classic, Ocean Breeze, Mahogany, Frosted Glass) with user persistence
- **Detached board window** — pop-out board in separate terminal for independent zoom/resize
- **Slash commands** — `/theme`, `/new`, `/resign`, `/draw`, `/accept`, `/decline`, `/analyze`, `/flip`, `/diff`, `/undo`, `/exit`
- **Interactive promotion** — dialog prompt for piece selection when a pawn reaches the last rank
- **Game interactions** — resign, draw, accept, decline, and new game all handled through DOM automation in the extension
- **Game over detection** — extension streams game results; TUI parses and displays them in the dialog box

## Next Priorities

### Multi-browser support

Currently Chrome-only. Extend to Firefox and other Chromium-based browsers. The extension uses standard WebExtension APIs, so Firefox porting is mostly manifest changes.

### Race condition reduction

The extension polls chess.com's DOM for game state at 250ms intervals. Fast game transitions (new game, rematch) can cause missed states or stale snapshots. Improve detection reliability with better polling strategies and fallback heuristics.

### Local game review

Leverage the bundled Stockfish engine for post-game analysis. After finishing a chess.com game, load the game FEN history locally and get move-by-move evaluation — free, ad-less, no chess.com premium needed.

### IPC robustness

Harden the WebSocket connection lifecycle. Better handling of extension disconnects, Chrome crashes, and stale socket cleanup. Automatic reconnection with state recovery.

## Backlog

- **Network health indicators** — detect degraded connections and warn the user
- **Game history browser** — navigate past games, load PGN files
