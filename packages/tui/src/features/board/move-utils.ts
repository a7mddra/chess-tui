import { Chess, type Square } from "chess.js";
import type { PremoveEntry } from "./types";

/** Swap the active turn in a FEN string so chess.js will accept a move for the
 *  other side. We also wipe en-passant and leave castling as-is. */
export const swapTurn = (fen: string): string => {
  const tokens = fen.split(" ");
  tokens[1] = tokens[1] === "w" ? "b" : "w";
  tokens[3] = "-"; // clear en-passant to avoid invalid-fen errors
  return tokens.join(" ");
};

/** Try a coordinate move on a Chess instance.  Returns the new Chess (clone)
 *  if the move was legal, or null. */
export const tryMove = (c: Chess, entry: PremoveEntry): Chess | null => {
  const clone = new Chess(c.fen());
  try {
    clone.move({ from: entry.from, to: entry.to, promotion: entry.promotion });
    return clone;
  } catch {
    return null;
  }
};

/** Same as tryMove but first swaps the active colour so we can test a premove
 *  that belongs to the *other* side. */
export const tryMoveSwapped = (c: Chess, entry: PremoveEntry): Chess | null => {
  const clone = new Chess(swapTurn(c.fen()));
  try {
    clone.move({ from: entry.from, to: entry.to, promotion: entry.promotion });
    return clone;
  } catch {
    return null;
  }
};

/** Parse a raw user string (e.g. "e2e4", "e7e8q", "Nf3") into a PremoveEntry
 *  if it looks like a coordinate-based move.  Returns null for SAN-style input
 *  so the caller can fall back. */
export const parseCoordinate = (input: string): PremoveEntry | null => {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(input);
  if (!m) return null;
  return {
    from: m[1]!.toLowerCase() as Square,
    to: m[2]!.toLowerCase() as Square,
    promotion: m[3]?.toLowerCase(),
  };
};
