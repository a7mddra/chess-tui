# Project Memo

## Branches
- `ext`
- `cli`

## ext Roadmap
1. Phase 1: move pieces from terminal input.
2. Phase 2: full IPC input <-> stream for opponent data, user data, ELO, clocks, zero-latency pipeline, and board FEN.

## cli Roadmap
1. Introduction to Ink and state-machine foundation.
2. Online production face of `tests/program.test.ts`.
3. Separate offline mode using `npm install stockfish` and `chess.js`.

## Current Focus
- `ext` + `tests/program.test.ts`.
- Terminal input like `e2e4` should affect the Chess.com board instantly.
