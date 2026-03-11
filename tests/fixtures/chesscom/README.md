# Chess.com HTML Fixtures

Purpose: store captured Chess.com HTML snapshots used by parser/selector tests.

## Naming
Use:
- `<page>.<YYYY-MM-DD>.html`

Example:
- `play-online.2026-03-11.html`

## Capture Metadata
When adding a new fixture, note in commit message or PR:
- source URL
- capture date/time
- account context (self-play, live game, bot game)
- selectors currently relied on

## Usage
- Prefer deterministic parser tests against these fixtures.
- Keep multiple dated snapshots when Chess.com layout changes.

## Security Note
These files can include session and account context data from page scripts.
If repository visibility is public/shared, sanitize sensitive values before commit.

Recommended redaction checklist:
- replace real usernames with stable placeholders (for example `user_one`, `user_two`)
- remove emails, IP addresses, and CSRF/session tokens
- redact JWT/API keys (`intercom`, `adyen`, `paypal`, etc.)
- replace stable account identifiers (user IDs, UUIDs, game IDs) with dummy values
- keep DOM structure, class names, and clock/board nodes intact for parser tests
