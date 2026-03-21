// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { Chess, type Square } from "chess.js";
import type { PremoveEntry } from "@/lib/chess/types";

export const swapTurn = (fen: string): string => {
  const tokens = fen.split(" ");
  tokens[1] = tokens[1] === "w" ? "b" : "w";
  tokens[3] = "-"; // clear en-passant to avoid invalid-fen errors
  return tokens.join(" ");
};

export const tryMove = (c: Chess, m: PremoveEntry): Chess | null => {
  const clone = new Chess(c.fen());
  try {
    clone.move({ from: m.from, to: m.to, promotion: m.promotion });
    return clone;
  } catch {
    return null;
  }
};

export const tryMoveSwapped = (c: Chess, m: PremoveEntry): Chess | null => {
  const clone = new Chess(swapTurn(c.fen()));
  try {
    clone.move({ from: m.from, to: m.to, promotion: m.promotion });
    return clone;
  } catch {
    return null;
  }
};

export const parseCoordinate = (san: string): PremoveEntry | null => {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(san);
  if (!m) return null;
  return {
    from: m[1]!.toLowerCase() as Square,
    to: m[2]!.toLowerCase() as Square,
    promotion: m[3]?.toLowerCase(),
  };
};
