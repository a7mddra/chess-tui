import { useState, useCallback, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import { getSpeculativeMoves, sqToCoords } from './generation';
import {
  type BoardCell,
  type PremoveEntry,
  type UndoSnapshot,
  type UseChessBoardOptions,
} from './types';
import { parseCoordinate, tryMove, tryMoveSwapped } from './move-utils';
export type { BoardCell, ChessBoardState } from './types';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useChessBoard = (
  initialFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  onMoveDispatch?: (uci: string) => void,
  options: UseChessBoardOptions = {}
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

  // -------------------------------------------------------------------------
  // Projected board: replays premoves on top of real board (display only)
  //
  // For a self-play scenario (user controls both colours) each premove
  // alternates turns.  If a premove doesn't match the current turn we swap
  // the turn before applying it.  If a premove is outright illegal even after
  // swapping, we stop replaying (invalid chain).
  // -------------------------------------------------------------------------

  // Speculative projected board: apply queued premoves by piece power only.
  // This is intentionally not strict chess legality and is used for previewing
  // premoves and chaining them while waiting for an opponent move.
  const projectedState = useMemo(() => {
    let projectedBoard = chess.board().map((row) => [...row]) as BoardCell[][];

    for (const pm of premoves) {
      const [fr, fc] = sqToCoords(pm.from);
      const [tr, tc] = sqToCoords(pm.to);

      const source = projectedBoard[fr]?.[fc];
      if (!source) break;

      const speculative = getSpeculativeMoves(projectedBoard, pm.from, source.color);
      if (!speculative.includes(pm.to)) break;

      const next = projectedBoard.map((row) => [...row]) as BoardCell[][];
      const isPromotionRow = source.type === 'p' && (tr === 0 || tr === 7);

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
  const lastRealMove = history.length > 0 ? {
    from: history[history.length - 1]!.from,
    to: history[history.length - 1]!.to,
  } : null;

  // Valid-move hints for the currently selected square (on the projected board)
  const validMoves = useMemo(() => {
    if (!selectedSquare) return [];
    
    // Check if the selected square actually belongs to the user on the projected board
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

  // Squares that should be highlighted red (premove path)
  const premoveJumps = useMemo(() => {
    const jumps: string[] = [];
    for (const pm of premoves) {
      jumps.push(pm.to);
    }
    return jumps;
  }, [premoves]);

  // -------------------------------------------------------------------------
  // Execute premoves after a real move has been made.
  // In online mode we only fire one premove.
  // In self-play mode we keep draining the queue to support deep chains.
  // Returns { newChess, remaining }.
  // -------------------------------------------------------------------------

  const flushPremoves = useCallback(
    (realChess: Chess, queue: PremoveEntry[]): { newChess: Chess; remaining: PremoveEntry[] } => {
      if (queue.length === 0) return { newChess: realChess, remaining: [] };

      let c = new Chess(realChess.fen());
      let idx = 0;

      while (idx < queue.length) {
        const entry = queue[idx]!;

        // Try the premove on the real board (current turn)
        let result = tryMove(c, entry);

        // Self-play only: also allow forcing the side-to-move swap so queued
        // same-colour chains can execute in dev mode.
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
    [onMoveDispatch, selfPlay]
  );

  // -------------------------------------------------------------------------
  // Core: attempt a move (real or premove)
  // -------------------------------------------------------------------------

  const attemptMove = useCallback(
    (entry: PremoveEntry) => {
      // 1. Try on real board – it's the user's actual turn
      const realResult = tryMove(chess, entry);
      if (realResult) {
        pushUndoSnapshot();
        const h = realResult.history({ verbose: true });
        const lastM = h[h.length - 1];
        if (lastM && onMoveDispatch) onMoveDispatch(lastM.lan ?? lastM.san);

        // After a real move, try to auto-fire queued premoves
        const { newChess, remaining } = flushPremoves(realResult, premoves);
        setChess(newChess);
        setPremoves(remaining);
        setSelectedSquare(null);
        return true;
      }

      // 2. It's not a real move – validate speculatively against projected board
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

        const speculativeValid = getSpeculativeMoves(board, entry.from, cell.color);
        if (speculativeValid.includes(entry.to)) {
          pushUndoSnapshot();
          setPremoves(prev => [...prev, entry]);
          setSelectedSquare(null);
          return true;
        }
      }

      return false;
    },
    [chess, board, realTurn, premoves, flushPremoves, onMoveDispatch, pushUndoSnapshot, selfPlay, playerColor]
  );

  // -------------------------------------------------------------------------
  // Handle raw user input (could be "e2e4", "e4", "Nf3", etc.)
  // -------------------------------------------------------------------------

  const handleUserInput = useCallback(
    (input: string) => {
      const normalized = input.trim();

      // -- Square-click mode (two sequential single-square inputs combine) --
      if (/^[a-h][1-8]$/i.test(normalized)) {
        const sq = normalized.toLowerCase() as Square;

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
          };
          const success = attemptMove(entry);
          if (!success) {
            // Not a valid move from selectedSquare to sq – reselect only if controllable
            setSelectedSquare(canSelectSquare(sq) ? sq : null);
          }
        } else {
          if (canSelectSquare(sq)) {
            setSelectedSquare(sq);
          }
        }
        return;
      }

      // -- Coordinate-pair input (e2e4, e7e8q, etc.) --
      const coord = parseCoordinate(normalized);
      if (coord) {
        if (attemptMove(coord)) return;
        setSelectedSquare(null);
        return;
      }

      // -- SAN input (Nf3, O-O, etc.) – try on real board, then future --
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
      } catch { /* not valid SAN for real board */ }

      setSelectedSquare(null);
    },
    [selectedSquare, attemptMove, chess, premoves, flushPremoves, onMoveDispatch, pushUndoSnapshot, board, selfPlay, playerColor, realTurn]
  );

  // -------------------------------------------------------------------------
  // Apply an opponent's move (from server / engine)
  // -------------------------------------------------------------------------

  const applyOpponentMove = useCallback(
    (moveStr: string) => {
      const realC = new Chess(chess.fen());
      try {
        const m = realC.move(moveStr);
        if (m && onMoveDispatch) onMoveDispatch(m.lan ?? m.san);

        // Try to auto-fire queued premoves
        const { newChess, remaining } = flushPremoves(realC, premoves);
        setChess(newChess);
        setPremoves(remaining);
      } catch { /* ignore invalid opponent move */ }
    },
    [chess, premoves, flushPremoves, onMoveDispatch]
  );

  // -------------------------------------------------------------------------
  // Commands (new game, undo, etc.)
  // -------------------------------------------------------------------------

  const executeCommand = useCallback(
    (cmdId: string) => {
      if (cmdId === 'new') {
        setChess(new Chess(initialFen));
        setPremoves([]);
        setSelectedSquare(null);
        setUndoStack([]);
      } else if (cmdId === 'undo') {
        if (undoStack.length > 0) {
          const last = undoStack[undoStack.length - 1]!;
          setUndoStack((prev) => prev.slice(0, -1));
          setChess(new Chess(last.fen));
          setPremoves(last.premoves);
          setSelectedSquare(last.selectedSquare);
          onUndoFenDispatch?.(last.fen);
          return;
        }

        // Fallback for legacy states not captured in undo stack.
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
      } else if (cmdId === 'restore' || cmdId === 'kill') {
        setPremoves([]);
        setSelectedSquare(null);
        setUndoStack([]);
      }
    },
    [initialFen, chess, premoves, undoStack, onUndoFenDispatch]
  );

  // -------------------------------------------------------------------------
  // Load an arbitrary FEN (e.g. from the extension)
  // -------------------------------------------------------------------------

  const loadFen = useCallback(
    (newFen: string) => {
      try {
        const targetBase = newFen.split(' ').slice(0, 2).join(' ');
        const currentBase = chess.fen().split(' ').slice(0, 2).join(' ');

        if (targetBase === currentBase) {
           return;
        }

        const possibleMoves = chess.moves({ verbose: true });
        const detectedMove = possibleMoves.find(m => {
           const clone = new Chess(chess.fen());
           clone.move(m);
           return clone.fen().split(' ').slice(0, 2).join(' ') === targetBase;
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
        // Try to salvage one premove against new position
        const { remaining } = flushPremoves(nextChess, premoves);
        setPremoves(remaining);
        setUndoStack([]);
      } catch { /* bad FEN */ }
    },
    [chess, premoves, flushPremoves]
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
