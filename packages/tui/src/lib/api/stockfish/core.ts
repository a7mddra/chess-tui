// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { userInfo } from "node:os";
import { Chess } from "chess.js";
import { PIECE_POWER, getPieceGlyph } from "@/lib/chess/piece";
import type { ApiPlayer } from "../index";
import { stockfishProcess } from "./process";
import type {
  EngineConnectionState,
  StockfishMoveResult,
  StockfishResignResult,
} from "./types";

type PieceCode = "p" | "n" | "b" | "r" | "q" | "k";
type SideColor = "w" | "b";
type Placement = "top" | "bottom";

type StockfishPlayers = {
  top: ApiPlayer;
  bottom: ApiPlayer;
};

type StockfishState = {
  fen: string;
  playerColor: SideColor;
  difficultyElo: number;
  thinking: boolean;
  gameOver: boolean;
  winner: SideColor | null;
  connection: EngineConnectionState;
  statusLine: string;
};

export type StockfishGameView = {
  fen: string;
  players: StockfishPlayers;
  activePlacement: Placement | null;
  userPlacement: Placement;
  boardOrientation: SideColor;
  orientationReady: true;
  connection: EngineConnectionState;
  statusLine: string;
  thinking: boolean;
  gameOver: boolean;
  winner: SideColor | null;
  difficultyElo: number;
  setFen: (fen: string) => void;
  requestEngineMove: (fen: string) => Promise<StockfishMoveResult>;
  startNewGame: () => string;
  resignGame: () => StockfishResignResult;
  flipSide: () => string;
  cycleDifficulty: () => number;
  setDifficultyElo: (elo: number) => number;
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const DIFFICULTY_LEVELS: number[] = [1200, 1400, 1600, 1900, 2200, 2500];

const OPENING_BOOK: Array<{ uci: string; weight: number }> = [
  { uci: "e2e4", weight: 0.62 },
  { uci: "d2d4", weight: 0.2 },
  { uci: "g1f3", weight: 0.1 },
  { uci: "c2c4", weight: 0.08 },
];

const PIECE_CODES: PieceCode[] = ["p", "n", "b", "r", "q", "k"];
const STARTING_COUNTS: Record<PieceCode, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};

const CAPTURE_RENDER_ORDER: PieceCode[] = ["q", "r", "b", "n", "p", "k"];

const LOCAL_USERNAME = (() => {
  try {
    return userInfo().username || "Player";
  } catch {
    return "Player";
  }
})();

const createPieceCounter = (): Record<PieceCode, number> => ({
  p: 0,
  n: 0,
  b: 0,
  r: 0,
  q: 0,
  k: 0,
});

const pickWeightedOpening = (): string => {
  const total = OPENING_BOOK.reduce((sum, item) => sum + item.weight, 0);
  const random = Math.random() * total;

  let acc = 0;
  for (const opening of OPENING_BOOK) {
    acc += opening.weight;
    if (random <= acc) {
      return opening.uci;
    }
  }

  return OPENING_BOOK[0]?.uci ?? "e2e4";
};

const applyUciMoveToFen = (fen: string, uci: string): string | null => {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;

    const move = chess.move({
      from,
      to,
      promotion,
    });

    return move ? chess.fen() : null;
  } catch {
    return null;
  }
};

const resolveStartFenForColor = (playerColor: SideColor): string => {
  if (playerColor === "w") {
    return START_FEN;
  }

  const openingMove = pickWeightedOpening();
  return applyUciMoveToFen(START_FEN, openingMove) ?? START_FEN;
};

const parseMaterial = (
  fen: string,
): {
  capturedBy: Record<SideColor, Record<PieceCode, number>>;
  score: Record<SideColor, number>;
} => {
  const placement = fen.trim().split(/\s+/)[0] ?? "";
  const boardCount: Record<SideColor, Record<PieceCode, number>> = {
    w: createPieceCounter(),
    b: createPieceCounter(),
  };

  for (const char of placement) {
    if (char === "/" || /\d/.test(char)) {
      continue;
    }

    const piece = char.toLowerCase() as PieceCode;
    if (!PIECE_CODES.includes(piece)) {
      continue;
    }

    const color: SideColor = char === piece ? "b" : "w";
    boardCount[color][piece] += 1;
  }

  const missing: Record<SideColor, Record<PieceCode, number>> = {
    w: createPieceCounter(),
    b: createPieceCounter(),
  };

  const score: Record<SideColor, number> = { w: 0, b: 0 };

  for (const color of ["w", "b"] as const) {
    for (const piece of PIECE_CODES) {
      const current = boardCount[color][piece];
      missing[color][piece] = Math.max(0, STARTING_COUNTS[piece] - current);

      if (piece === "k") {
        continue;
      }

      score[color] += current * PIECE_POWER[piece];
    }
  }

  return {
    capturedBy: {
      w: missing.b,
      b: missing.w,
    },
    score,
  };
};

const renderCaptured = (
  capturedByColor: Record<PieceCode, number>,
  renderedAsColor: SideColor,
): string => {
  const output: string[] = [];

  for (const piece of CAPTURE_RENDER_ORDER) {
    const count = capturedByColor[piece];
    for (let i = 0; i < count; i += 1) {
      output.push(getPieceGlyph(piece, renderedAsColor));
    }
  }

  return output.join("");
};

const formatPlayers = (
  fen: string,
  playerColor: SideColor,
  difficultyElo: number,
): StockfishPlayers => {
  const boardOrientation = playerColor;
  const topColor: SideColor = boardOrientation === "w" ? "b" : "w";
  const bottomColor: SideColor = boardOrientation;

  const material = parseMaterial(fen);

  const topCaptured = renderCaptured(
    material.capturedBy[topColor],
    bottomColor,
  );
  const bottomCaptured = renderCaptured(
    material.capturedBy[bottomColor],
    topColor,
  );

  const topScore = material.score[topColor];
  const bottomScore = material.score[bottomColor];
  const diff = Math.abs(topScore - bottomScore);

  const topAdvantage = topScore > bottomScore ? `+${diff}` : "";
  const bottomAdvantage = bottomScore > topScore ? `+${diff}` : "";

  const topName = topColor === playerColor ? LOCAL_USERNAME : "Stockfish";
  const bottomName = bottomColor === playerColor ? LOCAL_USERNAME : "Stockfish";

  const topElo = topName === "Stockfish" ? difficultyElo : null;
  const bottomElo = bottomName === "Stockfish" ? difficultyElo : null;

  return {
    top: {
      name: topName,
      elo: topElo,
      clock: "00:00",
      captured: topCaptured,
      advantage: topAdvantage,
    },
    bottom: {
      name: bottomName,
      elo: bottomElo,
      clock: "00:00",
      captured: bottomCaptured,
      advantage: bottomAdvantage,
    },
  };
};

const resolvePlacement = (
  fen: string,
  orientation: SideColor,
): Placement | null => {
  const turn = fen.trim().split(/\s+/)[1];
  if (turn !== "w" && turn !== "b") {
    return null;
  }

  const topColor: SideColor = orientation === "w" ? "b" : "w";
  return turn === topColor ? "top" : "bottom";
};

const initialState: StockfishState = {
  fen: START_FEN,
  playerColor: "w",
  difficultyElo: DIFFICULTY_LEVELS[2] ?? 1600,
  thinking: false,
  gameOver: false,
  winner: null,
  connection: "starting",
  statusLine: "loading engine resources",
};

export const useStockfishGame = (enabled: boolean): StockfishGameView => {
  const [state, setState] = useState<StockfishState>(initialState);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        await stockfishProcess.start();
        if (disposed) {
          return;
        }

        setState((prev) => ({
          ...prev,
          connection: stockfishProcess.connectionState,
          statusLine: "Stockfish v17.1.0",
        }));
      } catch (error) {
        if (disposed) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          connection: "error",
          statusLine: `engine error: ${message}`,
        }));
      }
    })();

    return () => {
      disposed = true;
    };
  }, [enabled]);

  const setFen = useCallback((fen: string) => {
    try {
      const validated = new Chess(fen).fen();
      setState((prev) => ({
        ...prev,
        fen: validated,
        gameOver: false,
        winner: null,
      }));
    } catch {
      // ignore bad FEN
    }
  }, []);

  const requestEngineMove = useCallback(
    async (fen: string): Promise<StockfishMoveResult> => {
      if (!enabled) {
        return { ok: false, error: "Stockfish mode is disabled." };
      }

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      setState((prev) => ({
        ...prev,
        thinking: true,
        statusLine: "Stockfish v17.1.0",
      }));

      try {
        const result = await stockfishProcess.analyze({
          fen,
          elo: state.difficultyElo,
          moveTimeMs: 320,
        });

        const bestMove = result.bestMove;
        if (!bestMove || bestMove === "(none)") {
          setState((prev) => ({
            ...prev,
            thinking: false,
            statusLine: "no legal move available",
            gameOver: true,
          }));
          return { ok: false, error: "No legal move available." };
        }

        const nextFen = applyUciMoveToFen(fen, bestMove);
        if (!nextFen) {
          setState((prev) => ({
            ...prev,
            thinking: false,
            statusLine: `illegal bestmove: ${bestMove}`,
          }));
          return {
            ok: false,
            error: `Engine returned invalid move ${bestMove}.`,
          };
        }

        setState((prev) => {
          if (requestId !== requestRef.current) {
            return prev;
          }

          return {
            ...prev,
            fen: nextFen,
            thinking: false,
            statusLine: "Stockfish v17.1.0",
          };
        });

        return {
          ok: true,
          fen: nextFen,
          bestMove,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState((prev) => ({
          ...prev,
          thinking: false,
          connection: stockfishProcess.connectionState,
          statusLine: `engine error: ${message}`,
        }));
        return { ok: false, error: message };
      }
    },
    [enabled, state.difficultyElo],
  );

  const startNewGame = useCallback((): string => {
    const nextFen = resolveStartFenForColor(state.playerColor);
    setState((prev) => ({
      ...prev,
      fen: nextFen,
      gameOver: false,
      winner: null,
      statusLine: "Stockfish v17.1.0",
    }));
    return nextFen;
  }, [state.playerColor]);

  const resignGame = useCallback((): StockfishResignResult => {
    const winner: SideColor = state.playerColor === "w" ? "b" : "w";

    setState((prev) => ({
      ...prev,
      gameOver: true,
      winner,
      thinking: false,
      statusLine: "Stockfish v17.1.0",
    }));

    return { winner };
  }, [state.playerColor]);

  const flipSide = useCallback((): string => {
    const nextColor: SideColor = state.playerColor === "w" ? "b" : "w";
    const nextFen = resolveStartFenForColor(nextColor);

    setState((prev) => ({
      ...prev,
      playerColor: nextColor,
      fen: nextFen,
      gameOver: false,
      winner: null,
      thinking: false,
      statusLine: "Stockfish v17.1.0",
    }));

    return nextFen;
  }, [state.playerColor]);

  const cycleDifficulty = useCallback((): number => {
    const currentIndex = DIFFICULTY_LEVELS.indexOf(state.difficultyElo);
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + 1) % DIFFICULTY_LEVELS.length;
    const next = DIFFICULTY_LEVELS[nextIndex] ?? DIFFICULTY_LEVELS[0] ?? 1600;

    setState((prev) => ({
      ...prev,
      difficultyElo: next,
      statusLine: "Stockfish v17.1.0",
    }));

    return next;
  }, [state.difficultyElo]);

  const setDifficultyElo = useCallback((elo: number): number => {
    const next = Math.max(100, Math.min(3000, Math.floor(elo)));

    setState((prev) => ({
      ...prev,
      difficultyElo: next,
      statusLine: "Stockfish v17.1.0",
    }));

    return next;
  }, []);

  const players = useMemo(
    () => formatPlayers(state.fen, state.playerColor, state.difficultyElo),
    [state.fen, state.playerColor, state.difficultyElo],
  );

  return {
    fen: state.fen,
    players,
    activePlacement: resolvePlacement(state.fen, state.playerColor),
    userPlacement: "bottom",
    boardOrientation: state.playerColor,
    orientationReady: true,
    connection: state.connection,
    statusLine: state.statusLine,
    thinking: state.thinking,
    gameOver: state.gameOver,
    winner: state.winner,
    difficultyElo: state.difficultyElo,
    setFen,
    requestEngineMove,
    startNewGame,
    resignGame,
    flipSide,
    cycleDifficulty,
    setDifficultyElo,
  };
};
