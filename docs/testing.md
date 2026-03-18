# Testing

## Philosophy

chess-tui is built on two core primitives:

1. **Stream/Watch** — scrape game state from chess.com and relay it to the terminal
2. **Inject** — send moves from the terminal back to chess.com via `board.move()`

The root-level test suite proves these two primitives work independently. Everything else (board rendering, premoves, player info, dialogs) is UI built on top. If the primitives work, the UI is a matter of React correctness, which TypeScript catches at compile time.

## Test Files

### `test:move-bridge` — Move injection test

```bash
npm run test:move-bridge
```

**What it proves:** Terminal input → WebSocket → extension → chess.com board injection works end-to-end.

**How to use:** Requires Chrome with the extension loaded and an active chess.com game tab. Start the test, type UCI moves (e.g., `e2e4`), and watch them execute on the chess.com board.

**File:** `tests/terminal-move-bridge.test.ts`

---

### `test:live-telemetry` — Game state streaming test

```bash
npm run test:live-telemetry
```

**What it proves:** chess.com game state → extension → WebSocket → terminal display works. Shows live FEN, player usernames, elo, clocks, and turn indicator.

**How to use:** Same prerequisites as move bridge. Start the test with a chess.com game open and watch the terminal display update in real-time as the game progresses.

**File:** `tests/live-telemetry.test.ts`

---

### `test:tui` — Dev UI harness

```bash
npm run test:tui
```

**What it proves:** The full TUI renders correctly with mock data. Board, input box, player info, dialog box — all wired together in a self-play environment (user controls both colors).

**How to use:** No Chrome or extension needed. Runs entirely locally with mock data. Useful for iterating on UI changes without needing a live chess.com session.

**File:** `tests/dev-tui.test.tsx`

## Fixture Sanitization

Chess.com page fixtures (HTML snapshots used for testing scraping logic) contain sensitive data:

- Authentication tokens and session cookies
- Premium membership indicators
- Account-specific identifiers

The `scripts/sanitize-fixture.sh` script strips all PII from fixtures before they're committed.

**Rule: never commit raw chess.com HTML fixtures.** Always run the sanitize script first:

```bash
npm run sanitize:fixture
```

Fixtures live in `tests/fixtures/chesscom/`.

## Verification Checklist

When making changes, run these before committing:

```bash
# TypeScript compilation (catches all import and type errors)
npm run tsc:tui
npm run tsc:ext

# Dev UI smoke test (no Chrome needed)
npm run test:tui

# Full integration test (requires Chrome + extension + chess.com tab)
npm run test:move-bridge
npm run test:live-telemetry
```

For pure UI or refactoring changes, `tsc:tui` + `test:tui` is sufficient. The bridge tests are only needed when changing extension code or WebSocket protocol.
