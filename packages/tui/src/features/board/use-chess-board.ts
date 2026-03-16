import { useState, useCallback, useMemo } from 'react';
import { Chess, Square } from 'chess.js';
import { getSpeculativeMoves, sqToCoords } from './generation';

export type BoardCell = {
  square: Square;
  type: string;
  color: 'w' | 'b';
} | null;

export type ChessBoardState = {
  board: BoardCell[][];
  lastRealMove: { from: string; to: string } | null;
  premoveJumps: string[];
  selectedSquare: string | null;
  validMoves: string[];
  turn: 'w' | 'b';
  fen: string;
};

type PremoveEntry = {
  from: Square;
  to: Square;
  promotion?: string;
};

type UseChessBoardOptions = {
  selfPlay?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Swap the active turn in a FEN string so chess.js will accept a move for the
 *  other side. We also wipe en-passant and leave castling as-is. */
const swapTurn = (fen: string): string => {
  const tokens = fen.split(' ');
  tokens[1] = tokens[1] === 'w' ? 'b' : 'w';
  tokens[3] = '-'; // clear en-passant to avoid invalid-fen errors
  return tokens.join(' ');
};

/** Try a coordinate move on a Chess instance.  Returns the new Chess (clone)
 *  if the move was legal, or null. */
const tryMove = (c: Chess, entry: PremoveEntry): Chess | null => {
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
const tryMoveSwapped = (c: Chess, entry: PremoveEntry): Chess | null => {
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
const parseCoordinate = (input: string): PremoveEntry | null => {
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(input);
  if (!m) return null;
  return {
    from: m[1]!.toLowerCase() as Square,
    to: m[2]!.toLowerCase() as Square,
    promotion: m[3]?.toLowerCase(),
  };
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useChessBoard = (
  initialFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  onMoveDispatch?: (uci: string) => void,
  options: UseChessBoardOptions = {}
) => {
  const selfPlay = options.selfPlay ?? false;
  const [chess, setChess] = useState(() => new Chess(initialFen));
  const [premoves, setPremoves] = useState<PremoveEntry[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Projected board: replays premoves on top of real board (display only)
  //
  // For a self-play scenario (user controls both colours) each premove
  // alternates turns.  If a premove doesn't match the current turn we swap
  // the turn before applying it.  If a premove is outright illegal even after
  // swapping, we stop replaying (invalid chain).
  // -------------------------------------------------------------------------

  const legalFutureChess = useMemo(() => {
    let c = new Chess(chess.fen());
    for (const pm of premoves) {
      // Try as-is first (matches current turn)
      const r1 = tryMove(c, pm);
      if (r1) { c = r1; continue; }
      // Try with swapped turn
      const r2 = tryMoveSwapped(c, pm);
      if (r2) { c = r2; continue; }
      // Illegal – stop projection
      break;
    }
    return c;
  }, [chess, premoves]);

  // Speculative projected board: apply queued premoves by piece power only.
  // This is intentionally not strict chess legality and is used for previewing
  // premoves and chaining them while waiting for an opponent move.
  const projectedState = useMemo(() => {
    let projectedBoard = chess.board().map((row) => [...row]) as BoardCell[][];
    let projectedTurn = chess.turn();

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
      projectedTurn = projectedTurn === 'w' ? 'b' : 'w';
    }

    return {
      board: projectedBoard,
      turn: projectedTurn,
    };
  }, [chess, premoves]);

  const board = projectedState.board;
  const turn = projectedState.turn;
  const fen = legalFutureChess.fen();

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

    if (cell.color === turn) {
      return legalFutureChess
        .moves({ square: selectedSquare as Square, verbose: true })
        .map((m) => m.to);
    }

    return getSpeculativeMoves(board, selectedSquare as Square, cell.color);
  }, [board, selectedSquare, turn, legalFutureChess]);

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
        if (cell.color === turn) {
          return false;
        }

        const speculativeValid = getSpeculativeMoves(board, entry.from, cell.color);
        if (speculativeValid.includes(entry.to)) {
          setPremoves(prev => [...prev, entry]);
          setSelectedSquare(null);
          return true;
        }
      }

      return false;
    },
    [chess, board, turn, premoves, flushPremoves, onMoveDispatch]
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
        if (selectedSquare) {
          const entry: PremoveEntry = {
            from: selectedSquare as Square,
            to: sq,
          };
          const success = attemptMove(entry);
          if (!success) {
            // Not a valid move from selectedSquare to sq – reselect
            setSelectedSquare(sq);
          }
        } else {
          setSelectedSquare(sq);
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
        if (m && onMoveDispatch) onMoveDispatch(m.lan ?? m.san);
        const { newChess, remaining } = flushPremoves(clone, premoves);
        setChess(newChess);
        setPremoves(remaining);
        setSelectedSquare(null);
        return;
      } catch { /* not valid SAN for real board */ }

      // Try SAN on futureChess as premove
      try {
        const clone = new Chess(legalFutureChess.fen());
        const m = clone.move(normalized);
        if (m) {
          const entry: PremoveEntry = { from: m.from, to: m.to, promotion: m.promotion };
          setPremoves(prev => [...prev, entry]);
          setSelectedSquare(null);
          return;
        }
      } catch { /* not valid SAN on future board either */ }

      // Try SAN with swapped turn on futureChess
      try {
        const clone = new Chess(swapTurn(legalFutureChess.fen()));
        const m = clone.move(normalized);
        if (m) {
          const entry: PremoveEntry = { from: m.from, to: m.to, promotion: m.promotion };
          setPremoves(prev => [...prev, entry]);
          setSelectedSquare(null);
          return;
        }
      } catch { /* nope */ }

      setSelectedSquare(null);
    },
    [selectedSquare, attemptMove, chess, legalFutureChess, premoves, flushPremoves, onMoveDispatch]
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
      } else if (cmdId === 'undo') {
        const c = new Chess(chess.fen());
        c.undo();
        setChess(c);
        setPremoves([]);
        setSelectedSquare(null);
      } else if (cmdId === 'restore' || cmdId === 'kill') {
        setPremoves([]);
        setSelectedSquare(null);
      }
    },
    [initialFen, chess]
  );

  // -------------------------------------------------------------------------
  // Load an arbitrary FEN (e.g. from the extension)
  // -------------------------------------------------------------------------

  const loadFen = useCallback(
    (newFen: string) => {
      try {
        const c = new Chess(newFen);
        setChess(c);
        // Try to salvage one premove against new position
        const { remaining } = flushPremoves(c, premoves);
        setPremoves(remaining);
      } catch { /* bad FEN */ }
    },
    [premoves, flushPremoves]
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
  };
};
