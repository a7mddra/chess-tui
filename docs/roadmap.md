# Roadmap

## Current State

chess-tui is feature-complete for core gameplay:

- **Online mode** — play chess.com from terminal, full end-to-end (move injection, FEN streaming, live clocks, player info, elo)
- **Offline mode** — play against Stockfish with adjustable elo (100–3000)
- **Bridge protocol v0** — stable WebSocket contract between extension and TUI
- **Premove system** — fully local, with speculative move generation and queue chaining
- **Board themes** — 4 themes (Classic, Ocean Breeze, Mahogany, Frosted Glass) with user persistence
- **Detached board window** — pop-out board in separate terminal for independent zoom/resize
- **Slash commands** — `/theme`, `/new`, `/resign`, `/flip`, `/diff`, `/undo`

## Next Priorities

### Multi-browser support
Currently Chrome-only. Extend to Firefox and other Chromium-based browsers. The extension uses standard WebExtension APIs, so Firefox porting is mostly manifest changes.

### Race condition reduction
The extension polls chess.com's DOM for game state. Fast game transitions (new game, rematch) can cause missed states or stale snapshots. Improve detection reliability with better polling strategies and fallback heuristics.

### Local game review
Leverage the bundled Stockfish engine for post-game analysis. After finishing a chess.com game, load the game FEN history locally and get move-by-move evaluation — free, ad-less, no chess.com premium needed.

### npm global package publication
Package as `npm install -g chess-tui` so users can run it from anywhere. Requires proper bin scripts, cross-platform compatibility testing, and a clean first-run experience.

### IPC robustness
Harden the WebSocket connection lifecycle. Better handling of extension disconnects, Chrome crashes, and stale socket cleanup. Automatic reconnection with state recovery.

## Backlog

- **Draw offer / resign via extension** — currently these use URL hooks (open chess.com pages). Phase 2 bridge protocol would allow direct button injection.
- **Game outcome events** — extension doesn't yet stream win/loss/draw/timeout events. TUI infers game state from FEN changes.
- **Network health indicators** — detect degraded connections and warn the user.
- **Game history browser** — navigate past games, load PGN files.
