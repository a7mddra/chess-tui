import {
  PIECE_POWER,
  getPieceGlyph,
  type PieceKind,
  type PieceColor,
} from "../../../features/board/piece";
import type { ApiPlayer } from "../index";
import type {
  DerivedOnlineState,
  GameClockSnapshot,
  PlayerClockSnapshot,
} from "./types";

type PieceCode = "p" | "n" | "b" | "r" | "q" | "k";
type SideColor = "w" | "b";

const PIECE_CODES: PieceCode[] = ["p", "n", "b", "r", "q", "k"];
const CAPTURE_RENDER_ORDER: PieceCode[] = ["q", "r", "b", "n", "p", "k"];

const STARTING_COUNTS: Record<PieceCode, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
  k: 1,
};

type MaterialStats = {
  capturedBy: Record<SideColor, Record<PieceCode, number>>;
  score: Record<SideColor, number>;
};

function formatClockFromMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function computeDisplayClock(
  player: PlayerClockSnapshot,
  nowMs: number,
  snapshotTakenAt: number,
): string {
  if (typeof player.clockMs !== "number") {
    return player.clockText ?? "00:00";
  }

  const elapsedSinceSnapshot = Math.max(0, nowMs - snapshotTakenAt);
  const liveMs = player.isTurn
    ? Math.max(0, player.clockMs - elapsedSinceSnapshot)
    : player.clockMs;
  return formatClockFromMs(liveMs);
}

function emptyPieceCounts(): Record<PieceCode, number> {
  return {
    p: 0,
    n: 0,
    b: 0,
    r: 0,
    q: 0,
    k: 0,
  };
}

function parseFenMaterial(fen: string | null): MaterialStats | null {
  if (!fen) {
    return null;
  }

  const placement = fen.trim().split(/\s+/)[0];
  if (!placement) {
    return null;
  }

  const boardCount: Record<SideColor, Record<PieceCode, number>> = {
    w: emptyPieceCounts(),
    b: emptyPieceCounts(),
  };

  for (const ch of placement) {
    if (ch === "/" || /\d/.test(ch)) {
      continue;
    }

    const lower = ch.toLowerCase();
    if (!PIECE_CODES.includes(lower as PieceCode)) {
      continue;
    }

    const piece = lower as PieceCode;
    const color: SideColor = ch === lower ? "b" : "w";
    boardCount[color][piece] += 1;
  }

  const missing: Record<SideColor, Record<PieceCode, number>> = {
    w: emptyPieceCounts(),
    b: emptyPieceCounts(),
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
}

function renderCaptured(
  captured: Record<PieceCode, number>,
  targetColor: SideColor,
): string {
  const symbols: string[] = [];

  for (const piece of CAPTURE_RENDER_ORDER) {
    const count = captured[piece];
    for (let i = 0; i < count; i += 1) {
      symbols.push(getPieceGlyph(piece as PieceKind, targetColor as PieceColor));
    }
  }

  return symbols.join("");
}

function toApiPlayer(
  player: PlayerClockSnapshot,
  clock: string,
  captured: string,
  advantage: string,
): ApiPlayer {
  const rawName = player.username ?? "n/a";
  const name = rawName.replace(/^[\s\u2654-\u265f]+/u, "").trim() || "n/a";

  return {
    name,
    elo: player.elo,
    clock,
    captured,
    advantage,
  };
}

export function deriveOnlineState(
  snapshot: GameClockSnapshot | null,
  fallbackFen: string | null,
  nowMs: number,
): DerivedOnlineState {
  if (!snapshot) {
    return {
      players: null,
      activePlacement: null,
      userPlacement: null,
      boardOrientation: null,
      orientationReady: false,
    };
  }

  const userClock = computeDisplayClock(snapshot.user, nowMs, snapshot.takenAt);
  const opponentClock = computeDisplayClock(
    snapshot.opponent,
    nowMs,
    snapshot.takenAt,
  );

  const topSource =
    snapshot.user.placement === "top" ? snapshot.user : snapshot.opponent;
  const bottomSource =
    snapshot.user.placement === "bottom" ? snapshot.user : snapshot.opponent;

  const topClock = topSource === snapshot.user ? userClock : opponentClock;
  const bottomClock = bottomSource === snapshot.user ? userClock : opponentClock;

  const activePlacement = snapshot.user.isTurn
    ? snapshot.user.placement
    : snapshot.opponent.isTurn
      ? snapshot.opponent.placement
      : null;

  const boardOrientation = snapshot.boardOrientation ?? null;

  const topColor: SideColor | null = boardOrientation
    ? boardOrientation === "w"
      ? "b"
      : "w"
    : null;
  const bottomColor: SideColor | null = boardOrientation;

  const material = parseFenMaterial(snapshot.fen ?? fallbackFen);

  const userNameReady =
    typeof snapshot.user.username === "string" &&
    snapshot.user.username.trim().length > 0;
  const opponentNameReady =
    typeof snapshot.opponent.username === "string" &&
    snapshot.opponent.username.trim().length > 0;
  const orientationReady =
    userNameReady && opponentNameReady && boardOrientation !== null;

  let topCaptured = "";
  let bottomCaptured = "";
  let topAdvantage = "";
  let bottomAdvantage = "";

  if (material && topColor && bottomColor) {
    topCaptured = renderCaptured(material.capturedBy[topColor], bottomColor);
    bottomCaptured = renderCaptured(material.capturedBy[bottomColor], topColor);

    const topScore = material.score[topColor];
    const bottomScore = material.score[bottomColor];
    const diff = Math.abs(topScore - bottomScore);

    if (topScore > bottomScore) {
      topAdvantage = `+${diff}`;
    } else if (bottomScore > topScore) {
      bottomAdvantage = `+${diff}`;
    }
  }

  return {
    players: {
      top: toApiPlayer(topSource, topClock, topCaptured, topAdvantage),
      bottom: toApiPlayer(
        bottomSource,
        bottomClock,
        bottomCaptured,
        bottomAdvantage,
      ),
    },
    activePlacement,
    userPlacement: snapshot.user.placement,
    boardOrientation,
    orientationReady,
  };
}
