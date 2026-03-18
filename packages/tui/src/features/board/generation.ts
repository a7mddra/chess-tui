import { Square } from "chess.js";
import { type BoardCell } from "./types";
import { PIECE_TPLS, isPieceKind } from "./piece";

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

// ---------------------------------------------------------------------------
// Move Generation
// ---------------------------------------------------------------------------

/**
 * Returns speculative valid moves for a given piece on the board.
 * This ignores check, pins, and strictly accepts the first piece hit in a ray,
 * because it's generating speculative premoves for the frontend.
 */
export const getSpeculativeMoves = (
  board: BoardCell[][],
  square: Square,
  turnColor: "w" | "b"
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
    if (!sq) return false; // out of bounds

    const targetCell = board[nr]?.[nc];
    
    // Always add the square (speculative - target might move away or be replaced)
    moves.push(sq);

    // Stop sliding if we hit ANY piece (friend or foe)
    if (targetCell) return false;
    
    return true; // Keep sliding
  };

  // -------------------------------------------------------------------------
  // Pawn Logic
  // -------------------------------------------------------------------------
  
  if (identity === "p") {
    const dir = turnColor === "w" ? -1 : 1;
    const startRow = turnColor === "w" ? 6 : 1;

    // 1 step forward
    const forwardSq = coordsToSq(r + dir, c);
    if (forwardSq && !board[r + dir]?.[c]) {
      moves.push(forwardSq);
      // 2 steps forward (only if 1 step was empty)
      if (r === startRow) {
        const doubleSq = coordsToSq(r + dir * 2, c);
        if (doubleSq && !board[r + dir * 2]?.[c]) {
          moves.push(doubleSq);
        }
      }
    }

    // Diagonal captures (speculative: always show them, since opponent might move there)
    const capLeft = coordsToSq(r + dir, c - 1);
    if (capLeft) moves.push(capLeft);

    const capRight = coordsToSq(r + dir, c + 1);
    if (capRight) moves.push(capRight);

    return moves;
  }

  // -------------------------------------------------------------------------
  // TPL Logic (Knights, Bishops, Rooks, Queens, Kings)
  // -------------------------------------------------------------------------

  for (const [dr, dc] of tpl.deltas) {
    let nr = r + dr;
    let nc = c + dc;

    if (tpl.isSliding) {
      while (addIfValid(nr, nc)) {
        nr += dr;
        nc += dc;
      }
    } else {
      addIfValid(nr, nc); // Leapers just jump once
    }
  }

  // Castling
  if (identity === "k") {
    // For speculative premoves, we just allow kings to jump 2 squares sideways.
    // If it's totally illegal when it comes to execute it, chess.js will reject it.
    const left2 = coordsToSq(r, c - 2);
    if (left2) moves.push(left2);
    
    const right2 = coordsToSq(r, c + 2);
    if (right2) moves.push(right2);
  }

  return moves;
};
