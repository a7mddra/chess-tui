# Bridge Protocol (v0)

The extension bridge is the WebSocket-based communication layer between the terminal app and the Chrome extension. The extension scrapes game state from an active chess.com tab and relays it to the TUI. The TUI sends move commands back through the same channel, which the extension injects via the page's `board.move()` API.

## Scope
This document defines the message contract between the TUI (or test harnesses) and the Chrome extension.

## Transport
- WebSocket endpoint: `ws://127.0.0.1:8765` (fallback `ws://localhost:8765` in extension client)
- TUI status line may display `ws://127.0.0.1:8765/<gameId>` once the active Chess.com game URL is known.
- Messages are JSON objects.

## Inbound (CLI -> Extension)

### Ping
```json
{ "type": "ping", "requestId": "optional-id" }
```

### Move
```json
{ "type": "move", "uci": "e2e4", "requestId": "optional-id" }
```
- `uci` must match: `^[a-h][1-8][a-h][1-8][qrbn]?$`

## Outbound (Extension -> CLI)

### Status
```json
{ "type": "status", "status": "connected|disconnected", "detail": "optional" }
```

### Pong
```json
{ "type": "pong", "requestId": "optional-id", "ts": 1710000000000 }
```

### Move Result
```json
{
  "type": "move-result",
  "requestId": "id",
  "ok": true,
  "fen": "optional",
  "error": "optional"
}
```

### Fen Update
```json
{ "type": "fen", "fen": "fen-string" }
```

### Game State Snapshot
```json
{
  "type": "game-state",
  "snapshot": {
    "takenAt": 1710000000000,
    "fen": "optional-fen",
    "user": {
      "username": "string|null",
      "elo": 1234,
      "clockText": "29:58",
      "clockMs": 1798000,
      "isTurn": true,
      "placement": "top|bottom"
    },
    "opponent": {
      "username": "string|null",
      "elo": 1300,
      "clockText": "30:00",
      "clockMs": 1800000,
      "isTurn": false,
      "placement": "top|bottom"
    }
  }
}
```

### Game Over
```json
{ "type": "game-over", "resultMessage": "optional-result-string" }
```

### Draw Offered
```json
{ "type": "draw-offered" }
```

### Draw Canceled
```json
{ "type": "draw-canceled" }
```

### Game URL
```json
{ "type": "game-url", "url": "https://www.chess.com/game/live/166211707474" }
```
- Consumers can derive and store `gameId` from this URL for actions such as opening review pages.

### Error
```json
{ "type": "error", "error": "message", "requestId": "optional-id" }
```

## Delivery Semantics
- Best-effort streaming.
- No ordering guarantee across reconnect boundaries.
- Consumers must treat snapshots as authoritative and idempotent.
- Consumers should ignore unknown fields for forward compatibility.

## Planned Extensions (Phase 2)

### Outbound events
- `game-over` (`resultMessage`) — *implemented*
- `draw-offered` — *implemented*
- `draw-canceled` — *implemented*
- `game-url` — *implemented*
- `game.network` (`degraded|recovered`) — *not yet implemented*

### Inbound commands
- `resign` — *implemented through extension interaction routing*
- `offer_draw` — *implemented as interaction (`draw`)*
- `new_game` — *implemented as interaction (`new`)*
- `open_url` (`analysis`, `signin`, `signout`, `new_game`) — *TUI handles URL opening directly (`/analyze` uses gameId from bridge state)*

## Compatibility Policy
- Additive changes are preferred.
- Existing fields and message types in v0 must remain stable.
- Any breaking change requires version bump (`v1`).
