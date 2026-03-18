# chess-tui

Play chess.com from your terminal. Your real account, your real Elo, no ads.

## What is this?

chess-tui is an alternative frontend for chess.com built as a terminal UI. It connects to chess.com's real infrastructure — your account, your rating, your opponents — through a Chrome extension that bridges the browser and terminal via WebSocket. You play in your terminal while the Chess.com tab sits minimized in the dock.

It also includes an offline mode where you play against Stockfish directly in the terminal, no browser needed.

## Why?

In the era of AI coding tools, developers spend more time in terminals than ever. TUIs are everywhere — claude-code, gemini-cli, copilot-cli. You're already in the terminal. Why tab-switch to a browser to play chess between prompts?

chess-tui brings chess.com into your terminal. Real games, real matchmaking, real Elo — just a different interface.

## How it works

```
chess.com tab  ←→  Chrome extension  ←→  WebSocket  ←→  Terminal UI (Ink/React)
```

Chess.com exposes `board.move()` in the page's JavaScript scope. Our extension uses this to inject moves and scrapes game state (FEN, clocks, player info) from the DOM. The TUI renders everything in the terminal and sends moves back through the same pipeline.

## Quick Start

```bash
# Install
npm install -g chess-tui

# Install the Chrome extension
# (load packages/ext/ as unpacked extension in chrome://extensions)

# Open chess.com in Chrome and start or resume a game

# Run
chess-tui
```

## Game Modes

### Online (chess.com)

Connect to your chess.com session through the extension. Play live games with real opponents, see clocks, elo, and captured pieces — all in the terminal.

### Offline (Stockfish)

Play against the Stockfish engine locally. Adjustable Elo from 100 to 3000. No browser or internet needed.

## Features

- **Live board rendering** with 4 color themes
- **Premove system** with speculative move hints
- **Detachable board window** — pop the board into a separate terminal and zoom independently
- **Slash commands** — `/theme`, `/new`, `/resign`, `/flip`, `/diff`, `/undo`
- **User preferences** persisted to `~/.config/chess-tui/`

## Documentation

- [Architecture](docs/architecture.md) — how the system works (start here for contributing)
- [Extension](docs/extension.md) — Chrome extension internals
- [Bridge Protocol](docs/bridge-protocol.md) — WebSocket message contract
- [Testing](docs/testing.md) — test lifecycle and fixture handling
- [Contributing](docs/contributing.md) — setup, conventions, and where to add code
- [Roadmap](docs/roadmap.md) — what's done and what's next
- [Security](security.md) — data boundary and fair-play policy

## Development

```bash
git clone https://github.com/a7mddra/chess-tui.git
cd chess-tui
npm install

npm run dev:tui      # Run the TUI
npm run build:ext    # Build the extension
npm run tsc:tui      # Type-check TUI
npm run tsc:ext      # Type-check extension
```

## Security & Fair Play

chess-tui does not endorse cheating. The extension injects moves the same way a human mouse click does — it calls the same `board.move()` function. However, connecting external engines to live games violates chess.com's terms of service. See [security.md](security.md) for the full policy.

## License

See [LICENSE](LICENSE).
