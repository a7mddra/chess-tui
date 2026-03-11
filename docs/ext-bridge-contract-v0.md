# Extension Bridge Contract (v0)

## Scope
This document defines the current online bridge contract between CLI/tests and the Chrome extension.

## Transport
- WebSocket endpoint: `ws://127.0.0.1:8765` (fallback `ws://localhost:8765` in extension client)
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
      "nationality": "string|null",
      "elo": 1234,
      "clockText": "29:58",
      "clockMs": 1798000,
      "isTurn": true,
      "placement": "top|bottom"
    },
    "opponent": {
      "username": "string|null",
      "nationality": "string|null",
      "elo": 1300,
      "clockText": "30:00",
      "clockMs": 1800000,
      "isTurn": false,
      "placement": "top|bottom"
    }
  }
}
```

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
- `game.outcome` (`win|lose|draw|timeout|abandon`)
- `game.network` (`degraded|recovered`)
- `game.offer` (`draw_offer_received`, `draw_offer_cleared`)

### Inbound commands
- `resign`
- `offer_draw`
- `new_game` (with time-control payload)
- `open_url` (`analysis`, `signin`, `signout`, `new_game`)

## Compatibility Policy
- Additive changes are preferred.
- Existing fields and message types in v0 must remain stable.
- Any breaking change requires version bump (`v1`).
