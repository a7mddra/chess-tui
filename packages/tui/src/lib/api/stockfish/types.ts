// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

export type EngineScore = {
  kind: "cp" | "mate";
  value: number;
};

export type EngineInfo = {
  depth?: number;
  seldepth?: number;
  multipv?: number;
  nodes?: number;
  nps?: number;
  hashfull?: number;
  timeMs?: number;
  pv?: string[];
  score?: EngineScore;
  raw: string;
};

export type ParsedUciLine =
  | {
      type: "info";
      info: EngineInfo;
      raw: string;
    }
  | {
      type: "bestmove";
      bestMove: string;
      ponder?: string;
      raw: string;
    }
  | {
      type: "readyok" | "uciok";
      raw: string;
    }
  | {
      type: "other";
      raw: string;
    };

export type EngineAnalyzeRequest = {
  fen: string;
  moveTimeMs?: number;
  elo?: number;
  threads?: number;
  hashMb?: number;
};

export type EngineAnalyzeResult = {
  bestMove: string | null;
  ponder?: string;
  info: EngineInfo[];
  score?: EngineScore;
};

export type EngineConnectionState = "starting" | "ready" | "error";

export type StockfishMoveResult = {
  ok: boolean;
  fen?: string;
  bestMove?: string;
  error?: string;
};

export type StockfishResignResult = {
  winner: "w" | "b";
};
