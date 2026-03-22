# Security & Responsibility

This document explains the security boundary of this project and the user's responsibility when running it.

## 1) Data Boundary: Streamer/Injector, Not Account Secret Storage

`chess-tui` is designed as a bridge between:

- terminal input/output
- a local WebSocket process
- browser page APIs on an active Chess.com tab

The project is not intended to collect or manage account secrets. In normal operation, it does not require storing:

- Chess.com passwords
- session cookies
- authentication tokens
- payment data

It reads game state needed for runtime behavior (for example FEN, clocks, player labels shown in the page UI) and injects move commands through the page bridge.

## 2) User Responsibility and Fair-Play Abuse

This project does not endorse cheating, botting, or unfair-play automation.

If a user chooses to connect external engines/bots (for example Stockfish or other AI systems) and uses them in ways that violate platform rules, that is solely the user's decision and responsibility.

Project maintainers are not responsible for:

- Chess.com warnings, fair-play actions, suspensions, or account bans
- losses caused by misuse of this software
- violations of third-party Terms of Service by end users

By using this project, you accept full responsibility for how you operate it and for compliance with all applicable platform policies and laws.

## Notes

- This file is a project policy statement, not legal advice.
- If you discover a real security vulnerability in this codebase, report it privately to the maintainers before public disclosure.
