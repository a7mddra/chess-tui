import { type Square } from "chess.js";

export type BoardCell = {
  square: Square;
  type: string;
  color: "w" | "b";
} | null;

export type ChessBoardState = {
  board: BoardCell[][];
  lastRealMove: { from: string; to: string } | null;
  premoveJumps: string[];
  selectedSquare: string | null;
  validMoves: string[];
  turn: "w" | "b";
  fen: string;
};

export type PremoveEntry = {
  from: Square;
  to: Square;
  promotion?: string;
};

export type UseChessBoardOptions = {
  selfPlay?: boolean;
  playerColor?: "w" | "b";
  onUndoFenDispatch?: (fen: string) => void;
};

export type UndoSnapshot = {
  fen: string;
  premoves: PremoveEntry[];
  selectedSquare: string | null;
};
