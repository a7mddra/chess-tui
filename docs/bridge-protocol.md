# Bridge Protocol (v0)

The extension bridge is the WebSocket-based communication layer between the terminal app and the Chrome extension. The extension scrapes game state from an active chess.com tab and relays it to the TUI. The TUI sends move commands and game interactions back through the same channel, which the extension injects via the page's `board.move()` API or DOM button clicks.

## Scope

This document defines the message contract between the TUI (or test harnesses) and the Chrome extension.

## Transport

- WebSocket endpoint: `ws://127.0.0.1:8765` (fallback `ws://localhost:8765` in extension client)
- The TUI runs the WebSocket server; the extension connects as a client
- The TUI also runs a relay server on port 8766 for test harnesses and external consumers
- Messages are JSON objects

## Inbound (TUI → Extension)

### Ping

```json
{ "type": "ping", "requestId": "optional-id" }
```

### Move

```json
{ "type": "move", "uci": "e2e4", "requestId": "optional-id" }
```

- `uci` must match: `^[a-h][1-8][a-h][1-8][qrbn]?$/i`

### Interaction

```json
{ "type": "interaction", "command": "resign", "requestId": "optional-id" }
```

- `command` is one of: `"new"`, `"resign"`, `"draw"`, `"accept"`, `"decline"`
- These trigger DOM button clicks on the chess.com page

## Outbound (Extension → TUI)

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

### FEN Update

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
    "boardOrientation": "w",
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

- `boardOrientation` indicates which color the user is playing (`"w"` or `"b"`)
- `nationality` is a 2-letter country code (e.g. `"US"`) extracted from DOM flag elements

### Game Over

```json
{ "type": "game-over", "resultMessage": "result-string" }
```

- An empty `resultMessage` indicates the game-over state has cleared (new game started)

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

- Consumers derive and store `gameId` from this URL for actions such as opening review pages

### Error

```json
{ "type": "error", "error": "message", "requestId": "optional-id" }
```

## Delivery Semantics

- Best-effort streaming
- No ordering guarantee across reconnect boundaries
- Consumers must treat snapshots as authoritative and idempotent
- Consumers should ignore unknown fields for forward compatibility

## Implementation Status

### Outbound events

- `game-state` with `boardOrientation` — ✅ implemented
- `game-over` (`resultMessage`) — ✅ implemented
- `draw-offered` — ✅ implemented
- `draw-canceled` — ✅ implemented
- `game-url` — ✅ implemented
- `game.network` (`degraded|recovered`) — not yet implemented

### Inbound commands

- `move` — ✅ implemented
- `interaction` (`new`, `resign`, `draw`, `accept`, `decline`) — ✅ implemented

## Compatibility Policy

- Additive changes are preferred
- Existing fields and message types in v0 must remain stable
- Any breaking change requires version bump (`v1`)
