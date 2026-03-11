const CONTENT_SOURCE = "chess-tui-content";
const PAGE_SOURCE = "chess-tui-page";
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
const BOARD_SELECTORS = ["chess-board", "wc-chess-board"];
const FEN_POLL_INTERVAL_MS = 250;

type UnknownRecord = Record<string, unknown>;

interface ChessGame {
  getFEN?: () => string;
  getLegalMoves?: () => unknown[];
  move?: (move: UnknownRecord) => unknown;
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

function emitFenIfChanged(force = false): void {
  const fen = readFen();
  if (!fen) {
    return;
  }

  if (!force && fen === lastFen) {
    return;
  }

  lastFen = fen;
  postToContent({
    type: "FEN_UPDATE",
    fen
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
  postToContent({
    type: "MOVE_RESULT",
    requestId: data.requestId,
    ok: result.ok,
    fen: result.fen,
    error: result.error
  });

  if (result.ok) {
    emitFenIfChanged(true);
  }
});

window.setInterval(() => {
  emitFenIfChanged(false);
}, FEN_POLL_INTERVAL_MS);

postToContent({
  type: "BRIDGE_READY",
  fen: readFen() ?? undefined
});
emitFenIfChanged(true);
