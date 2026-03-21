// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { useState, useCallback, useMemo } from "react";
import { Chess, Square } from "chess.js";
import { getSpeculativeMoves, sqToCoords } from "./generation";
import {
  type BoardCell,
  type PremoveEntry,
  type UndoSnapshot,
  type UseChessBoardOptions,
} from "@/lib/chess/types";
import { parseCoordinate, tryMove, tryMoveSwapped } from "./move-utils";
export type { BoardCell, ChessBoardState } from "@/lib/chess/types";
export { useBoardIpcServer, useBoardIpcClient } from "./board-ipc";

export const useChessBoard = (
  initialFen: string = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  onMoveDispatch?: (uci: string) => void,
  options: UseChessBoardOptions = {},
) => {
  const selfPlay = options.selfPlay ?? false;
  const playerColor = options.playerColor;
  const onUndoFenDispatch = options.onUndoFenDispatch;
  const [chess, setChess] = useState(() => new Chess(initialFen));
  const [premoves, setPremoves] = useState<PremoveEntry[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [
      ...prev,
      {
        fen: chess.fen(),
        premoves,
        selectedSquare,
      },
    ]);
  }, [chess, premoves, selectedSquare]);

  const projectedState = useMemo(() => {
    let projectedBoard = chess.board().map((row) => [...row]) as BoardCell[][];

    for (const pm of premoves) {
      const [fr, fc] = sqToCoords(pm.from);
      const [tr, tc] = sqToCoords(pm.to);

      const source = projectedBoard[fr]?.[fc];
      if (!source) break;

      const speculative = getSpeculativeMoves(
        projectedBoard,
        pm.from,
        source.color,
      );
      if (!speculative.includes(pm.to)) break;

      const next = projectedBoard.map((row) => [...row]) as BoardCell[][];
      const isPromotionRow = source.type === "p" && (tr === 0 || tr === 7);

      next[fr]![fc] = null;
      next[tr]![tc] = {
        square: pm.to,
        type: isPromotionRow && pm.promotion ? pm.promotion : source.type,
        color: source.color,
      };

      projectedBoard = next;
    }

    return {
      board: projectedBoard,
    };
  }, [chess, premoves]);

  const board = projectedState.board;
  const realTurn = chess.turn();
  const turn = realTurn;
  const fen = chess.fen();

  const history = chess.history({ verbose: true });
  const lastRealMove =
    history.length > 0
      ? {
          from: history[history.length - 1]!.from,
          to: history[history.length - 1]!.to,
        }
      : null;

  const validMoves = useMemo(() => {
    if (!selectedSquare) return [];

    const [r, c] = sqToCoords(selectedSquare as Square);
    const cell = board[r]?.[c];
    if (!cell) return [];

    const canControlColor = selfPlay
      ? true
      : playerColor
        ? cell.color === playerColor
        : cell.color === realTurn;
    if (!canControlColor) {
      return [];
    }

    if (cell.color === realTurn) {
      return chess
        .moves({ square: selectedSquare as Square, verbose: true })
        .map((m) => m.to);
    }

    return getSpeculativeMoves(board, selectedSquare as Square, cell.color);
  }, [board, selectedSquare, realTurn, chess, selfPlay, playerColor]);

  const premoveJumps = useMemo(() => {
    const jumps: string[] = [];
    for (const pm of premoves) {
      jumps.push(pm.to);
    }
    return jumps;
  }, [premoves]);

  const flushPremoves = useCallback(
    (
      realChess: Chess,
      queue: PremoveEntry[],
    ): { newChess: Chess; remaining: PremoveEntry[] } => {
      if (queue.length === 0) return { newChess: realChess, remaining: [] };

      let c = new Chess(realChess.fen());
      let idx = 0;

      while (idx < queue.length) {
        const entry = queue[idx]!;

        let result = tryMove(c, entry);

        if (!result && selfPlay) {
          result = tryMoveSwapped(c, entry);
        }

        if (!result) {
          return { newChess: c, remaining: [] };
        }

        const m = result.history({ verbose: true });
        const lastM = m[m.length - 1];
        if (lastM && onMoveDispatch) onMoveDispatch(lastM.lan ?? lastM.san);

        c = result;
        idx += 1;

        if (!selfPlay) {
          return { newChess: c, remaining: queue.slice(idx) };
        }
      }

      return { newChess: c, remaining: [] };
    },
    [onMoveDispatch, selfPlay],
  );

  const attemptMove = useCallback(
    (entry: PremoveEntry) => {
      const realResult = tryMove(chess, entry);
      if (realResult) {
        pushUndoSnapshot();
        const h = realResult.history({ verbose: true });
        const lastM = h[h.length - 1];
        if (lastM && onMoveDispatch) onMoveDispatch(lastM.lan ?? lastM.san);

        const { newChess, remaining } = flushPremoves(realResult, premoves);
        setChess(newChess);
        setPremoves(remaining);
        setSelectedSquare(null);
        return true;
      }

      const [r, c] = sqToCoords(entry.from);
      const cell = board[r]?.[c];

      if (cell) {
        const canControlColor = selfPlay
          ? true
          : playerColor
            ? cell.color === playerColor
            : cell.color === realTurn;

        if (!canControlColor) {
          return false;
        }

        if (cell.color === realTurn) {
          return false;
        }

        const speculativeValid = getSpeculativeMoves(
          board,
          entry.from,
          cell.color,
        );
        if (speculativeValid.includes(entry.to)) {
          pushUndoSnapshot();
          setPremoves((prev) => [...prev, entry]);
          setSelectedSquare(null);
          return true;
        }
      }

      return false;
    },
    [
      chess,
      board,
      realTurn,
      premoves,
      flushPremoves,
      onMoveDispatch,
      pushUndoSnapshot,
      selfPlay,
      playerColor,
    ],
  );

  const handleUserInput = useCallback(
    (input: string) => {
      const normalized = input.trim();

      if (/^[a-h][1-8][qrbn]?$/i.test(normalized)) {
        const sqMatch = /^([a-h][1-8])([qrbn])?$/i.exec(normalized);
        const sq = sqMatch![1]!.toLowerCase() as Square;
        const promotionStr = sqMatch![2]?.toLowerCase();

        const canSelectSquare = (target: Square): boolean => {
          const [tr, tc] = sqToCoords(target);
          const targetCell = board[tr]?.[tc];
          if (!targetCell) {
            return false;
          }

          if (selfPlay) {
            return true;
          }

          if (playerColor) {
            return targetCell.color === playerColor;
          }

          return targetCell.color === realTurn;
        };

        if (selectedSquare) {
          const entry: PremoveEntry = {
            from: selectedSquare as Square,
            to: sq,
            promotion: promotionStr,
          };
          const success = attemptMove(entry);
          if (!success) {
            setSelectedSquare(canSelectSquare(sq) ? sq : null);
          }
        } else {
          if (canSelectSquare(sq)) {
            setSelectedSquare(sq);
          }
        }
        return;
      }

      const coord = parseCoordinate(normalized);
      if (coord) {
        if (attemptMove(coord)) return;
        setSelectedSquare(null);
        return;
      }

      try {
        const clone = new Chess(chess.fen());
        const m = clone.move(normalized);
        pushUndoSnapshot();
        if (m && onMoveDispatch) onMoveDispatch(m.lan ?? m.san);
        const { newChess, remaining } = flushPremoves(clone, premoves);
        setChess(newChess);
        setPremoves(remaining);
        setSelectedSquare(null);
        return;
      } catch {
        /* not valid SAN for real board */
      }

      setSelectedSquare(null);
    },
    [
      selectedSquare,
      attemptMove,
      chess,
      premoves,
      flushPremoves,
      onMoveDispatch,
      pushUndoSnapshot,
      board,
      selfPlay,
      playerColor,
      realTurn,
    ],
  );

  const applyOpponentMove = useCallback(
    (moveStr: string) => {
      const realC = new Chess(chess.fen());
      try {
        const m = realC.move(moveStr);
        if (m && onMoveDispatch) onMoveDispatch(m.lan ?? m.san);

        const { newChess, remaining } = flushPremoves(realC, premoves);
        setChess(newChess);
        setPremoves(remaining);
      } catch {
        /* ignore invalid opponent move */
      }
    },
    [chess, premoves, flushPremoves, onMoveDispatch],
  );

  const executeCommand = useCallback(
    (cmdId: string) => {
      if (cmdId === "new") {
        setChess(new Chess(initialFen));
        setPremoves([]);
        setSelectedSquare(null);
        setUndoStack([]);
      } else if (cmdId === "undo") {
        if (undoStack.length > 0) {
          const last = undoStack[undoStack.length - 1]!;
          setUndoStack((prev) => prev.slice(0, -1));
          setChess(new Chess(last.fen));
          setPremoves(last.premoves);
          setSelectedSquare(last.selectedSquare);
          onUndoFenDispatch?.(last.fen);
          return;
        }

        if (premoves.length > 0) {
          setPremoves((prev) => prev.slice(0, -1));
          setSelectedSquare(null);
          return;
        }

        const c = new Chess(chess.fen());
        const undone = c.undo();
        if (undone) {
          setChess(c);
          onUndoFenDispatch?.(c.fen());
        }
        setSelectedSquare(null);
      } else if (cmdId === "restore" || cmdId === "kill") {
        setPremoves([]);
        setSelectedSquare(null);
        setUndoStack([]);
      }
    },
    [initialFen, chess, premoves, undoStack, onUndoFenDispatch],
  );

  const loadFen = useCallback(
    (newFen: string) => {
      try {
        const targetBase = newFen.split(" ").slice(0, 2).join(" ");
        const currentBase = chess.fen().split(" ").slice(0, 2).join(" ");

        if (targetBase === currentBase) {
          return;
        }

        const possibleMoves = chess.moves({ verbose: true });
        const detectedMove = possibleMoves.find((m) => {
          const clone = new Chess(chess.fen());
          clone.move(m);
          return clone.fen().split(" ").slice(0, 2).join(" ") === targetBase;
        });

        let nextChess: Chess;
        if (detectedMove) {
          const clone = new Chess(chess.fen());
          clone.move(detectedMove);
          nextChess = clone;
        } else {
          nextChess = new Chess(newFen);
        }

        setChess(nextChess);
        const { remaining } = flushPremoves(nextChess, premoves);
        setPremoves(remaining);
        setUndoStack([]);
      } catch {
        /* bad FEN */
      }
    },
    [chess, premoves, flushPremoves],
  );

  return {
    board,
    lastRealMove,
    premoveJumps,
    selectedSquare,
    validMoves,
    turn,
    fen,
    handleUserInput,
    applyOpponentMove,
    executeCommand,
    loadFen,
    clearSelection: () => setSelectedSquare(null),
    clearPremoves: () => setPremoves([]),
    hasPremoves: premoves.length > 0,
  };
};
