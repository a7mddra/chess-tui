const CONTENT_SOURCE = "chess-tui-content";
const PAGE_SOURCE = "chess-tui-page";
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
const BOARD_SELECTORS = ["chess-board", "wc-chess-board"];
const FEN_POLL_INTERVAL_MS = 250;

const TOP_PLAYER_ID = "board-layout-player-top";
const BOTTOM_PLAYER_ID = "board-layout-player-bottom";

type UnknownRecord = Record<string, unknown>;
type PlayerPlacement = "top" | "bottom";

type PlayerClockSnapshot = {
  username: string | null;
  nationality: string | null;
  elo: number | null;
  clockText: string | null;
  clockMs: number | null;
  isTurn: boolean;
  placement: PlayerPlacement;
};

type GameClockSnapshot = {
  takenAt: number;
  fen: string | null;
  user: PlayerClockSnapshot;
  opponent: PlayerClockSnapshot;
};

interface ChessGame {
  getFEN?: () => string;
  getLegalMoves?: () => unknown[];
  getPlayers?: () => unknown;
  move?: (move: UnknownRecord) => unknown;
  players?: unknown;
  gameData?: unknown;
  state?: unknown;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as UnknownRecord;
}

function normalizeName(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length ? cleaned : null;
}

function postToContent(payload: UnknownRecord): void {
  window.postMessage(
    {
      source: PAGE_SOURCE,
      target: CONTENT_SOURCE,
      ...payload
    },
    "*"
  );
}

function getGame(): ChessGame | null {
  for (const selector of BOARD_SELECTORS) {
    const board = document.querySelector(selector) as (Element & { game?: ChessGame }) | null;
    if (!board?.game) {
      continue;
    }

    return board.game;
  }

  return null;
}

function readFen(): string | null {
  const game = getGame();
  if (!game || typeof game.getFEN !== "function") {
    return null;
  }

  try {
    return String(game.getFEN());
  } catch {
    return null;
  }
}

function normalizeSquare(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.slice(0, 2).toLowerCase();
}

function normalizePromotion(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const promotion = value.toLowerCase().charAt(0);
  if (!["q", "r", "b", "n"].includes(promotion)) {
    return null;
  }

  return promotion;
}

function parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
  if (!UCI_MOVE_REGEX.test(uci)) {
    return null;
  }

  const normalized = uci.toLowerCase();
  const from = normalized.slice(0, 2);
  const to = normalized.slice(2, 4);
  const promotion = normalized.length === 5 ? normalized[4] : undefined;

  return {
    from,
    to,
    promotion
  };
}

function findLegalMove(game: ChessGame, uci: string): UnknownRecord | null {
  if (typeof game.getLegalMoves !== "function") {
    return null;
  }

  const parsed = parseUci(uci);
  if (!parsed) {
    return null;
  }

  const legalMoves = game.getLegalMoves();
  if (!Array.isArray(legalMoves)) {
    return null;
  }

  for (const legalMove of legalMoves) {
    if (typeof legalMove !== "object" || legalMove === null) {
      continue;
    }

    const move = legalMove as UnknownRecord;
    const from = normalizeSquare(move.from ?? move.start ?? move.source);
    const to = normalizeSquare(move.to ?? move.end ?? move.target);
    if (from !== parsed.from || to !== parsed.to) {
      continue;
    }

    const candidatePromotion = normalizePromotion(move.promotion);
    if (parsed.promotion && candidatePromotion && candidatePromotion !== parsed.promotion) {
      continue;
    }

    if (parsed.promotion && !candidatePromotion) {
      continue;
    }

    return move;
  }

  return null;
}

function parseClockToMs(clockText: string | null): number | null {
  if (!clockText) {
    return null;
  }

  const text = clockText.trim();
  if (!text.length) {
    return null;
  }

  if (text.includes(":")) {
    const parts = text.split(":");
    if (parts.length < 2 || parts.length > 3) {
      return null;
    }

    const numericParts = parts.map((part) => Number.parseFloat(part));
    if (numericParts.some((part) => Number.isNaN(part))) {
      return null;
    }

    if (parts.length === 2) {
      const minutes = numericParts[0] ?? 0;
      const seconds = numericParts[1] ?? 0;
      return Math.max(0, Math.round(minutes * 60_000 + seconds * 1_000));
    }

    const hours = numericParts[0] ?? 0;
    const minutes = numericParts[1] ?? 0;
    const seconds = numericParts[2] ?? 0;
    return Math.max(0, Math.round(hours * 3_600_000 + minutes * 60_000 + seconds * 1_000));
  }

  const maybeSeconds = Number.parseFloat(text);
  if (!Number.isNaN(maybeSeconds)) {
    return Math.max(0, Math.round(maybeSeconds * 1_000));
  }

  return null;
}

function currentUsernameFromContext(): string | null {
  const win = window as Window & {
    context?: UnknownRecord;
    chesscom?: UnknownRecord;
  };

  const contextUser = asRecord(win.context)?.user;
  const chesscomUser = asRecord(win.chesscom)?.user;

  const fromContext = asRecord(contextUser)?.username;
  if (typeof fromContext === "string" && fromContext.trim().length) {
    return fromContext.trim();
  }

  if (typeof chesscomUser === "string" && chesscomUser.trim().length) {
    return chesscomUser.trim();
  }

  return null;
}

function extractCountryFromElement(playerRoot: Element): string | null {
  const countryEl = playerRoot.querySelector(".country-flags-component");
  if (!countryEl) {
    return null;
  }

  for (const className of Array.from(countryEl.classList)) {
    const match = className.match(/^country-([a-z]{2})$/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

function extractEloFromElement(playerRoot: Element): number | null {
  const ratingEl = playerRoot.querySelector('[class*="rating"], [data-cy*="rating"], [data-test-element*="rating"]');
  const ratingText = ratingEl?.textContent?.trim() ?? "";

  const textCandidates = [ratingText, playerRoot.textContent ?? ""];
  for (const text of textCandidates) {
    const bracketMatch = text.match(/\((\d{2,5})\)/);
    if (bracketMatch && bracketMatch[1]) {
      return Number.parseInt(bracketMatch[1], 10);
    }

    const looseMatch = text.match(/\b(\d{3,5})\b/);
    if (looseMatch && looseMatch[1]) {
      return Number.parseInt(looseMatch[1], 10);
    }
  }

  return null;
}

function extractClockState(playerRoot: Element): {
  clockText: string | null;
  clockMs: number | null;
  isTurn: boolean;
} {
  const clockRoot = playerRoot.querySelector(".clock-component");
  const clockText = normalizeName(
    clockRoot?.querySelector(".clock-time-monospace")?.textContent?.replace(/\s+/g, " ") ?? null
  );

  return {
    clockText,
    clockMs: parseClockToMs(clockText),
    isTurn: clockRoot?.classList.contains("clock-player-turn") ?? false
  };
}

function mergePlayerMetaFromCandidate(
  value: unknown,
  map: Map<string, { elo: number | null; nationality: string | null }>
): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const entry of value) {
    const data = asRecord(entry);
    if (!data) {
      continue;
    }

    const usernameValue = data.username ?? data.userName ?? data.name ?? data.handle;
    if (typeof usernameValue !== "string") {
      continue;
    }

    const username = usernameValue.trim().toLowerCase();
    if (!username.length) {
      continue;
    }

    const country = asRecord(data.country);
    const countryCode =
      (typeof country?.code === "string" && country.code.trim().toUpperCase()) ||
      (typeof country?.name === "string" && country.name.trim()) ||
      (typeof data.countryCode === "string" && data.countryCode.trim().toUpperCase()) ||
      null;

    const ratingValue = data.rating ?? data.elo ?? data.liveRating ?? data.rapidRating;
    const elo = typeof ratingValue === "number" && Number.isFinite(ratingValue) ? Math.round(ratingValue) : null;

    map.set(username, {
      elo,
      nationality: countryCode
    });
  }
}

function buildPlayerMetaMap(): Map<string, { elo: number | null; nationality: string | null }> {
  const map = new Map<string, { elo: number | null; nationality: string | null }>();

  const game = getGame();
  if (game) {
    const gameRecord = game as UnknownRecord;
    mergePlayerMetaFromCandidate(gameRecord.players, map);
    mergePlayerMetaFromCandidate(asRecord(gameRecord.gameData)?.players, map);
    mergePlayerMetaFromCandidate(asRecord(gameRecord.state)?.players, map);

    if (typeof game.getPlayers === "function") {
      try {
        mergePlayerMetaFromCandidate(game.getPlayers(), map);
      } catch {
        // Ignore if shape changes.
      }
    }
  }

  const win = window as Window & { context?: UnknownRecord };
  const contextUser = asRecord(win.context)?.user;
  const contextData = asRecord(contextUser);
  if (contextData && typeof contextData.username === "string") {
    const username = contextData.username.trim().toLowerCase();
    if (username.length) {
      const country = asRecord(contextData.country);
      const nationality =
        (typeof country?.code === "string" && country.code.trim().toUpperCase()) ||
        (typeof country?.name === "string" && country.name.trim()) ||
        null;
      const rating =
        typeof contextData.rating === "number" && Number.isFinite(contextData.rating)
          ? Math.round(contextData.rating)
          : null;

      map.set(username, {
        elo: rating,
        nationality
      });
    }
  }

  return map;
}

function readPlayerSnapshot(
  placement: PlayerPlacement,
  metaMap: Map<string, { elo: number | null; nationality: string | null }>
): PlayerClockSnapshot | null {
  const rootId = placement === "top" ? TOP_PLAYER_ID : BOTTOM_PLAYER_ID;
  const root = document.getElementById(rootId);
  if (!root) {
    return null;
  }

  const username = normalizeName(
    root.querySelector('[data-test-element="user-tagline-username"]')?.textContent ?? null
  );

  const key = username?.toLowerCase() ?? "";
  const meta = key.length ? metaMap.get(key) : undefined;

  const nationality = extractCountryFromElement(root) ?? meta?.nationality ?? null;
  const elo = extractEloFromElement(root) ?? meta?.elo ?? null;
  const clockState = extractClockState(root);

  return {
    username,
    nationality,
    elo,
    clockText: clockState.clockText,
    clockMs: clockState.clockMs,
    isTurn: clockState.isTurn,
    placement
  };
}

function readGameClockSnapshot(fen: string | null): GameClockSnapshot | null {
  const metaMap = buildPlayerMetaMap();
  const top = readPlayerSnapshot("top", metaMap);
  const bottom = readPlayerSnapshot("bottom", metaMap);

  if (!top || !bottom) {
    return null;
  }

  const currentUsername = currentUsernameFromContext()?.toLowerCase() ?? null;

  let userSnapshot: PlayerClockSnapshot = bottom;
  let opponentSnapshot: PlayerClockSnapshot = top;

  if (currentUsername && top.username?.toLowerCase() === currentUsername) {
    userSnapshot = top;
    opponentSnapshot = bottom;
  } else if (currentUsername && bottom.username?.toLowerCase() === currentUsername) {
    userSnapshot = bottom;
    opponentSnapshot = top;
  }

  return {
    takenAt: Date.now(),
    fen,
    user: userSnapshot,
    opponent: opponentSnapshot
  };
}

function applyMove(uci: string): { ok: boolean; fen?: string; error?: string } {
  const game = getGame();
  if (!game || typeof game.move !== "function") {
    return {
      ok: false,
      error: "Board API not available yet."
    };
  }

  const parsed = parseUci(uci);
  if (!parsed) {
    return {
      ok: false,
      error: `Invalid UCI move: ${uci}`
    };
  }

  const legalMove = findLegalMove(game, uci);
  if (!legalMove) {
    return {
      ok: false,
      error: `Illegal move for current position: ${uci}`
    };
  }

  const movePayload: UnknownRecord = {
    ...legalMove,
    animate: false,
    userGenerated: true
  };

  if (parsed.promotion) {
    movePayload.promotion = parsed.promotion;
  }

  try {
    game.move(movePayload);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown move error."
    };
  }

  return {
    ok: true,
    fen: readFen() ?? undefined
  };
}

let lastFen = "";
let lastSnapshotSignal = "";

function buildSnapshotSignal(snapshot: GameClockSnapshot | null): string {
  if (!snapshot) {
    return "no-snapshot";
  }

  return [
    snapshot.user.username ?? "",
    snapshot.user.placement,
    snapshot.user.isTurn ? "1" : "0",
    snapshot.opponent.username ?? "",
    snapshot.opponent.placement,
    snapshot.opponent.isTurn ? "1" : "0"
  ].join("|");
}

function emitFenIfChanged(force = false): void {
  const fen = readFen();
  if (!fen) {
    return;
  }

  const snapshot = readGameClockSnapshot(fen);
  const snapshotSignal = buildSnapshotSignal(snapshot);
  const fenChanged = fen !== lastFen;
  const snapshotChanged = snapshotSignal !== lastSnapshotSignal;

  if (!force && !fenChanged && !snapshotChanged) {
    return;
  }

  lastFen = fen;
  lastSnapshotSignal = snapshotSignal;

  postToContent({
    type: "FEN_UPDATE",
    fen,
    snapshot: snapshot ?? undefined
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window || typeof event.data !== "object" || event.data === null) {
    return;
  }

  const data = event.data as UnknownRecord;
  if (data.source !== CONTENT_SOURCE || data.target !== PAGE_SOURCE || data.type !== "APPLY_MOVE") {
    return;
  }

  if (typeof data.requestId !== "string" || typeof data.uci !== "string") {
    return;
  }

  const result = applyMove(data.uci);
  const fen = result.fen ?? readFen();
  const snapshot = readGameClockSnapshot(fen);

  postToContent({
    type: "MOVE_RESULT",
    requestId: data.requestId,
    ok: result.ok,
    fen: result.fen,
    error: result.error,
    snapshot: snapshot ?? undefined
  });

  if (result.ok) {
    emitFenIfChanged(true);
  }
});

window.setInterval(() => {
  emitFenIfChanged(false);
}, FEN_POLL_INTERVAL_MS);

const initialFen = readFen();
const initialSnapshot = readGameClockSnapshot(initialFen);

postToContent({
  type: "BRIDGE_READY",
  fen: initialFen ?? undefined,
  snapshot: initialSnapshot ?? undefined
});

emitFenIfChanged(true);
