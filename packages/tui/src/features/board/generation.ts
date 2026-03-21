// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { Square } from "chess.js";
import { type BoardCell } from "@/lib/chess/types";
import { PIECE_TPLS, isPieceKind } from "@/lib/chess/piece";

const FILES = "abcdefgh";
const fileToIndex = (f: string) => FILES.indexOf(f);
const indexToFile = (i: number) => FILES[i];
const rowToIndex = (r: string) => 8 - parseInt(r, 10);
const indexToRow = (i: number) => (8 - i).toString();

export const sqToCoords = (sq: Square): [number, number] => {
  const f = sq[0]!;
  const r = sq[1]!;
  return [rowToIndex(r), fileToIndex(f)];
};

export const coordsToSq = (r: number, c: number): Square | null => {
  if (r < 0 || r > 7 || c < 0 || c > 7) return null;
  const f = indexToFile(c);
  const row = indexToRow(r);
  return `${f}${row}` as Square;
};

export const getSpeculativeMoves = (
  board: BoardCell[][],
  square: Square,
  turnColor: "w" | "b",
): string[] => {
  const [r, c] = sqToCoords(square);
  const cell = board[r]?.[c];

  if (!cell || cell.color !== turnColor) {
    return [];
  }

  const identity = cell.type.toLowerCase();
  if (!isPieceKind(identity)) return [];
  const tpl = PIECE_TPLS[identity];

  const moves: string[] = [];

  const addIfValid = (nr: number, nc: number): boolean => {
    const sq = coordsToSq(nr, nc);
    if (!sq) return false;

    const targetCell = board[nr]?.[nc];

    moves.push(sq);

    if (targetCell) return false;

    return true;
  };

  if (identity === "p") {
    const dir = turnColor === "w" ? -1 : 1;
    const startRow = turnColor === "w" ? 6 : 1;

    const forwardSq = coordsToSq(r + dir, c);
    if (forwardSq && !board[r + dir]?.[c]) {
      moves.push(forwardSq);

      if (r === startRow) {
        const doubleSq = coordsToSq(r + dir * 2, c);
        if (doubleSq && !board[r + dir * 2]?.[c]) {
          moves.push(doubleSq);
        }
      }
    }

    const capLeft = coordsToSq(r + dir, c - 1);
    if (capLeft) moves.push(capLeft);

    const capRight = coordsToSq(r + dir, c + 1);
    if (capRight) moves.push(capRight);

    return moves;
  }

  for (const [dr, dc] of tpl.deltas) {
    let nr = r + dr;
    let nc = c + dc;

    if (tpl.isSliding) {
      while (addIfValid(nr, nc)) {
        nr += dr;
        nc += dc;
      }
    } else {
      addIfValid(nr, nc);
    }
  }

  if (identity === "k") {
    const left2 = coordsToSq(r, c - 2);
    if (left2) moves.push(left2);

    const right2 = coordsToSq(r, c + 2);
    if (right2) moves.push(right2);
  }

  return moves;
};
