# CLI State Machine (Online Mode)

## Purpose
Define a deterministic runtime model for the terminal app so browser bridge events, user input, and network failures are handled predictably.

## Core States
- `boot`
- `bridge_waiting`
- `bridge_connected_idle`
- `game_syncing`
- `game_active`
- `game_paused`
- `game_over`
- `fatal_error`

## Event Sources
- Extension bridge events (WebSocket).
- User commands from terminal.
- Local timers (clock tick, staleness checks).

## Event Catalog

### Bridge Events
- `bridge.connected`
- `bridge.disconnected`
- `bridge.status`
- `bridge.error`
- `game.fen`
- `game.snapshot` (user/opponent clocks and metadata)
- `move.result` (`ok`, `error`)
- Planned:
  - `game.outcome` (`win`, `lose`, `draw`, `timeout`, `abandon`)
  - `game.offer` (`draw_offer`, `takeback_offer`, etc.)

### User Events
- `user.connect`
- `user.move` (`uci`)
- `user.resign`
- `user.offer_draw`
- `user.new_game`
- `user.open_url` (`analysis`, `signin`, etc.)
- `user.quit`

### Timer Events
- `timer.tick_1s`
- `timer.snapshot_stale`

## Transition Rules

1. `boot -> bridge_waiting`
- Trigger: app startup.

2. `bridge_waiting -> bridge_connected_idle`
- Trigger: `bridge.connected`.
- Action: clear bridge error, start keepalive.

3. `bridge_connected_idle -> game_syncing`
- Trigger: first `game.fen` or `game.snapshot`.
- Action: initialize board and telemetry models.

4. `game_syncing -> game_active`
- Trigger: both board state and at least one snapshot available.
- Action: enable input commands.

5. `game_active -> game_paused`
- Trigger: `bridge.disconnected`.
- Action: freeze commands that require bridge; keep UI visible.

6. `game_paused -> game_active`
- Trigger: `bridge.connected` + fresh `game.snapshot`.
- Action: re-sync clocks using latest snapshot timestamp.

7. `game_active -> game_over`
- Trigger: outcome event (planned) or authoritative end marker.
- Action: lock move input, show result reason and next actions.

8. `any -> fatal_error`
- Trigger: unrecoverable protocol mismatch or repeated parser failure.

## Clock Policy
- Use snapshot values as source of truth (`clockMs`, `takenAt`, `isTurn`).
- Update display every second locally.
- Rebase to fresh snapshot on each move/event update.
- If snapshots become stale beyond threshold, mark clocks degraded but keep UI running.

## Command Policy
- Commands allowed in `game_active`:
  - `move`
  - `resign` (planned)
  - `offer_draw` (planned)
- Commands allowed in `bridge_connected_idle`:
  - `new_game` (planned URL hook)
- Commands blocked in `game_paused`:
  - all bridge-dependent actions (show actionable error).

## Data Model (Minimal)
- `session`:
  - `state`
  - `bridgeConnected`
  - `lastBridgeError`
- `game`:
  - `fen`
  - `ply`
  - `result` (optional)
  - `resultReason` (optional)
- `players`:
  - `user` (`username`, `elo`, `nationality`, `clockMs`, `isTurn`)
  - `opponent` (same fields)
- `timing`:
  - `snapshotTakenAt`
  - `lastTickAt`

## Implementation Notes
- Reducer-first architecture:
  - `nextState = reducer(prevState, event)`
- Side effects (websocket send, URL open, logging) run outside reducer.
- Maintain append-only event logs in debug mode for replay.
