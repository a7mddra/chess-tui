// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

/**
 * Validate algebraic chess notation.
 * Matches: e2e4, Nf3, O-O, O-O-O, exd5, e8=Q, etc.
 */
export const isValidAlgebraic = (move: string): boolean =>
  /^([a-h][1-8]-?[qrbn]?|[a-h][1-8]-?[a-h][1-8]-?[qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O(-O)?)$/i.test(
    move,
  );
