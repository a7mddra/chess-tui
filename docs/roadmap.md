# Chess TUI Roadmap

## Goal
Build a production-grade terminal chess app (`cli`) that controls and mirrors live Chess.com games through a Chrome extension (`ext`), then add an offline mode.

## Current Baseline
- Move bridge works end-to-end (`terminal -> ws -> extension -> chess.com board API`).
- Live telemetry works (`fen`, usernames, country, elo, clocks with local ticking).
- Two test entry points:
  - `npm run test:move-bridge`
  - `npm run test:live-telemetry`

## Strategy
1. Treat `ext` as a stable adapter.
2. Shift primary development to `cli + ink`.
3. Add only targeted `ext` features needed by CLI milestones.
4. Keep offline mode as a separate phase to avoid scope collision.

## Milestones

### M1: Lock Bridge Contract (v0)
Scope:
- Freeze message schema currently used by move bridge and telemetry.
- Define compatibility rules for future fields/events.

Done criteria:
- Contract documented and referenced by CLI and extension.
- No breaking changes to current tests.

### M2: CLI Foundation (Ink + State Machine)
Scope:
- First `ink` app shell.
- State machine with core lifecycle states.
- Render board from `fen`.
- Render telemetry panel (user/opponent clocks, name, elo, country).

Done criteria:
- CLI starts, connects, and renders a live game without manual reboots.
- Clock display updates smoothly from telemetry snapshots + local ticking.

### M3: Online Play UX (Production Face)
Scope:
- Command input for moves and core actions.
- Error handling and reconnect UX.
- Session transitions (`waiting`, `in-game`, `game-over`).

Done criteria:
- Full game playable from terminal against live Chess.com session.
- Clear user feedback for disconnects, illegal move, and recovery.

### M4: Extension Phase 2 (Game Events + Controls)
Scope:
- Outcome/events stream:
  - draw offer/accept
  - resign
  - timeout
  - win/lose
  - abandon/disconnect hints
- Action commands:
  - resign
  - offer draw
  - new game hooks
- URL hooks:
  - start blitz/rapid/bullet
  - bot game
  - analysis page
  - sign-in/sign-out entry points

Done criteria:
- CLI can drive all core session actions without opening browser UI controls.
- State machine receives enough events to classify game termination reasons.

### M5: Offline Mode (Separate Track)
Scope:
- `chess.js` for legal rules/state.
- `stockfish` npm package for engine play.
- Same CLI shell, different backend adapter.

Done criteria:
- User can switch online/offline modes without changing UI mental model.

## Backlog Buckets

### Watcher/Telemetry
- Game end detection and reason code normalization.
- Opponent disconnect/reconnect hints.
- Network health and stale snapshot detection.

### Input/Commands
- Resign, draw offer, new game.
- Optional shortcut keys and confirmation prompts for destructive commands.

### State Machine
- Distinguish `bridge disconnected` vs `game disconnected`.
- Deterministic transition policy on reconnect and late events.

### External URL Hooks
- Start specific time controls.
- Open current game in browser.
- Open analysis from active game.

## Guardrails
- Keep `ext` focused on bridge responsibilities, not business logic.
- Keep game logic and UX decisions in `cli` state machine.
- Add fields/events compatibly (append-only where possible).
