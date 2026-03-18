import type { EngineInfo, EngineScore, ParsedUciLine } from "./types";

const parseIntSafe = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseScore = (tokens: string[], scoreIdx: number): EngineScore | undefined => {
  const kind = tokens[scoreIdx + 1];
  const valueToken = tokens[scoreIdx + 2];
  const value = parseIntSafe(valueToken);

  if (!kind || value === undefined) {
    return undefined;
  }

  if (kind === "cp" || kind === "mate") {
    return { kind, value };
  }

  return undefined;
};

export const parseUciInfoLine = (line: string): EngineInfo | null => {
  const raw = line.trim();
  if (!raw.startsWith("info ")) {
    return null;
  }

  const tokens = raw.split(/\s+/);
  const pvIdx = tokens.indexOf("pv");
  const scoreIdx = tokens.indexOf("score");

  const info: EngineInfo = {
    raw,
    depth: parseIntSafe(tokens[tokens.indexOf("depth") + 1]),
    seldepth: parseIntSafe(tokens[tokens.indexOf("seldepth") + 1]),
    multipv: parseIntSafe(tokens[tokens.indexOf("multipv") + 1]),
    nodes: parseIntSafe(tokens[tokens.indexOf("nodes") + 1]),
    nps: parseIntSafe(tokens[tokens.indexOf("nps") + 1]),
    hashfull: parseIntSafe(tokens[tokens.indexOf("hashfull") + 1]),
    timeMs: parseIntSafe(tokens[tokens.indexOf("time") + 1]),
    score: scoreIdx >= 0 ? parseScore(tokens, scoreIdx) : undefined,
    pv: pvIdx >= 0 ? tokens.slice(pvIdx + 1) : undefined,
  };

  return info;
};

export const parseUciLine = (line: string): ParsedUciLine => {
  const raw = line.trim();

  if (raw === "readyok" || raw === "uciok") {
    return {
      type: raw,
      raw,
    };
  }

  if (raw.startsWith("bestmove ")) {
    const tokens = raw.split(/\s+/);
    return {
      type: "bestmove",
      bestMove: tokens[1] ?? "(none)",
      ponder:
        tokens[2] === "ponder" && typeof tokens[3] === "string"
          ? tokens[3]
          : undefined,
      raw,
    };
  }

  const info = parseUciInfoLine(raw);
  if (info) {
    return {
      type: "info",
      info,
      raw,
    };
  }

  return {
    type: "other",
    raw,
  };
};
