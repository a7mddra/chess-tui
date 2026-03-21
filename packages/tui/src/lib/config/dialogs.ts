// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { PIECES_BY_CODE } from "@/lib/chess/piece";

// ---------------------------------------------------------------------------
// Dialog messages — contextual messages shown in the dialog box
// ---------------------------------------------------------------------------

export type DialogMessage = {
  /** Unique key for looking up a dialog */
  key: string;
  /** Lines of text rendered inside the dialog box */
  lines: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

const d = (key: string, lines: string[]): DialogMessage => ({ key, lines });

// ── Dialog catalogue ──────────────────────────────────────────────────────

/** Default instructions shown at game start */
export const DIALOG_HOWTO = d("howto", [
  "• e2e4 to move a piece",
  "• e2 to see valid moves",
  "• / for commands",
  "• ? for shortcuts",
]);

// -- Draw ------------------------------------------------------------------

export const DIALOG_DRAW_OFFERED = d("draw_offered", [
  "Opponent offered a draw.",
  "/accept or /decline",
]);

// -- Win / Loss ------------------------------------------------------------

export const DIALOG_BLACK_WON_TIME = d("black_won_time", [
  "⏱ Black won on time.",
]);

export const DIALOG_WHITE_WON_TIME = d("white_won_time", [
  "⏱ White won on time.",
]);

export const DIALOG_BLACK_WON_CHECKMATE = d("black_won_checkmate", [
  `${PIECES_BY_CODE.k.glyph} Black won by checkmate.`,
]);

export const DIALOG_WHITE_WON_CHECKMATE = d("white_won_checkmate", [
  `${PIECES_BY_CODE.K.glyph} White won by checkmate.`,
]);

export const DIALOG_BLACK_WON_RESIGNATION = d("black_won_resignation", [
  "Black won by resignation.",
]);

export const DIALOG_WHITE_WON_RESIGNATION = d("white_won_resignation", [
  "White won by resignation.",
]);

export const DIALOG_YOU_WON = d("you_won", [
  "🎉 You won! Well played.",
  "/new to start another game.",
]);

// -- Game over (draws) -----------------------------------------------------

export const DIALOG_DRAW_AGREEMENT = d("draw_agreement", [
  "Game drawn by agreement.",
]);

export const DIALOG_DRAW_STALEMATE = d("draw_stalemate", [
  "Game drawn by stalemate.",
]);

export const DIALOG_DRAW_REPETITION = d("draw_repetition", [
  "Game drawn by repetition.",
]);

export const DIALOG_DRAW_INSUFFICIENT = d("draw_insufficient", [
  "Draw by insufficient material.",
]);

export const DIALOG_ABANDONED = d("abandoned", ["Game over — abandoned."]);

// -- Searching / connecting ------------------------------------------------

export const DIALOG_SEARCHING = d("searching", ["Searching for an opponent…"]);

// -- Errors ----------------------------------------------------------------

export const DIALOG_ERROR = d("error", [
  "An unexpected error occurred.",
  "Please try again.",
]);

export const DIALOG_INVALID_INPUT = d("invalid_input", [
  "Invalid input.",
  "Type e2e4 or / for commands.",
]);

export const DIALOG_INVALID_ELO_INPUT = d("invalid_elo_input", [
  "Invalid engine level.",
  "Enter a value from 100 to 3000.",
]);

export const DIALOG_ELO_PROMPT = d("elo_prompt", [
  "Set engine Elo [100-3000]",
  "Esc cancels this prompt.",
]);

// -- Browser / external game -----------------------------------------------

export const DIALOG_BROWSER_START = d("browser_start", [
  "Open your browser and start a game, or reload a previously opened tab.",
]);

// -- Promotion -------------------------------------------------------------

export const DIALOG_PROMOTION_PROMPT = d("promotion_prompt", [
  "Promote to:",
  `${PIECES_BY_CODE.Q.glyph} (q)ueen, ${PIECES_BY_CODE.R.glyph} (r)ook,`,
  `${PIECES_BY_CODE.B.glyph} (b)ishop, ${PIECES_BY_CODE.N.glyph} (k)night`,
]);

// -- Stockfish / AI --------------------------------------------------------

export const DIALOG_STOCKFISH = d("stockfish", [
  "Playing vs the engine.",
  "",
  "/diff to adjust Elo,",
  "/flip to play as Black.",
]);
