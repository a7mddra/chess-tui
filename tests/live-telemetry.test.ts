import process from "node:process";

import { WebSocket } from "ws";

const RELAY_URL = process.env.CHESS_TUI_WATCHER_URL ?? "ws://127.0.0.1:8766";
const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 5000] as const;

type PlayerClockSnapshot = {
  username: string | null;
  nationality: string | null;
  elo: number | null;
  clockText: string | null;
  clockMs: number | null;
  isTurn: boolean;
  placement: "top" | "bottom";
};

type GameClockSnapshot = {
  takenAt: number;
  fen: string | null;
  user: PlayerClockSnapshot;
  opponent: PlayerClockSnapshot;
  boardOrientation?: "w" | "b";
};

type IncomingMessage =
  | {
      type: "status";
      status: "connected" | "disconnected";
      detail?: string;
    }
  | {
      type: "fen";
      fen: string;
    }
  | {
      type: "game-state";
      snapshot: GameClockSnapshot;
    }
  | {
      type: "pong";
      requestId?: string;
      ts: number;
    }
  | {
      type: "move-result";
      requestId: string;
      ok: boolean;
      error?: string;
      fen?: string;
    }
  | {
      type: "error";
      error: string;
      requestId?: string;
    };

let relaySocket: WebSocket | null = null;
let renderTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let isShuttingDown = false;

let latestSnapshot: GameClockSnapshot | null = null;
let latestFen: string | null = null;
let relayStatus = `connecting to relay (${RELAY_URL})`;
let extensionStatus = "waiting for extension status";
let lastSocketEvent = "not connected";

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

function computeDisplayClock(player: PlayerClockSnapshot, nowMs: number, snapshotTakenAt: number): string {
  if (typeof player.clockMs !== "number") {
    return player.clockText ?? "--:--";
  }

  const elapsedSinceSnapshot = Math.max(0, nowMs - snapshotTakenAt);
  const liveMs = player.isTurn ? Math.max(0, player.clockMs - elapsedSinceSnapshot) : player.clockMs;
  return formatClockFromMs(liveMs);
}

function drawWatcherScreen(): void {
  const now = Date.now();

  process.stdout.write("\x1Bc");
  process.stdout.write("Chess.com Watcher (shared relay mode)\n");
  process.stdout.write(`Relay: ${relayStatus}\n`);
  process.stdout.write(`Extension: ${extensionStatus}\n`);
  process.stdout.write(`Socket: ${lastSocketEvent}\n`);

  if (!latestSnapshot) {
    process.stdout.write("\nWaiting for first game snapshot...\n");
    process.stdout.write("Tip: run `npm run test:move-bridge`, then make a move on chess.com.\n");
    process.stdout.write("Press Ctrl+C to stop.\n");
    return;
  }

  latestFen = latestSnapshot.fen ?? latestFen;
  const userClock = computeDisplayClock(latestSnapshot.user, now, latestSnapshot.takenAt);
  const opponentClock = computeDisplayClock(latestSnapshot.opponent, now, latestSnapshot.takenAt);
  const boardOrientation = latestSnapshot.boardOrientation === "b"
    ? "flipped (black)"
    : latestSnapshot.boardOrientation === "w"
      ? "normal (white)"
      : "unknown";

  process.stdout.write(`Latest FEN: ${latestFen ?? "n/a"}\n`);
  process.stdout.write(`Board orientation: ${boardOrientation}\n`);
  process.stdout.write(`Snapshot TS: ${new Date(latestSnapshot.takenAt).toISOString()}\n`);
  process.stdout.write("\n");

  process.stdout.write("user>\n");
  process.stdout.write(`username> ${latestSnapshot.user.username ?? "n/a"}\n`);
  process.stdout.write(`nationality> ${latestSnapshot.user.nationality ?? "n/a"}\n`);
  process.stdout.write(`elo> ${latestSnapshot.user.elo ?? "n/a"}\n`);
  process.stdout.write(`time> ${userClock}${latestSnapshot.user.isTurn ? " (turn)" : ""}\n`);

  process.stdout.write("---\n");

  process.stdout.write("opp>\n");
  process.stdout.write(`username> ${latestSnapshot.opponent.username ?? "n/a"}\n`);
  process.stdout.write(`nationality> ${latestSnapshot.opponent.nationality ?? "n/a"}\n`);
  process.stdout.write(`elo> ${latestSnapshot.opponent.elo ?? "n/a"}\n`);
  process.stdout.write(`time> ${opponentClock}${latestSnapshot.opponent.isTurn ? " (turn)" : ""}\n`);

  process.stdout.write("\nPress Ctrl+C to stop.\n");
}

function handleIncoming(raw: unknown): void {
  if (typeof raw !== "object" || raw === null || typeof (raw as { type?: unknown }).type !== "string") {
    return;
  }

  const message = raw as IncomingMessage;

  switch (message.type) {
    case "status": {
      extensionStatus = `${message.status}${message.detail ? ` (${message.detail})` : ""}`;
      return;
    }
    case "fen": {
      latestFen = message.fen;
      return;
    }
    case "game-state": {
      latestSnapshot = message.snapshot;
      latestFen = message.snapshot.fen ?? latestFen;
      return;
    }
    case "pong": {
      if (message.requestId?.startsWith("__hb_")) {
        return;
      }
      lastSocketEvent = `pong ${new Date(message.ts).toISOString()}`;
      return;
    }
    case "move-result": {
      if (!message.ok && message.error) {
        lastSocketEvent = `move failed: ${message.error}`;
      }
      if (message.fen) {
        latestFen = message.fen;
      }
      return;
    }
    case "error": {
      lastSocketEvent = `error: ${message.error}`;
      return;
    }
    default:
      return;
  }
}

function scheduleReconnect(): void {
  if (isShuttingDown || reconnectTimer) {
    return;
  }

  const index = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
  const delay = RECONNECT_DELAYS_MS[index];
  reconnectAttempt += 1;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRelay();
  }, delay);
}

function connectRelay(): void {
  if (isShuttingDown) {
    return;
  }

  if (relaySocket && (relaySocket.readyState === WebSocket.OPEN || relaySocket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  relayStatus = `connecting to relay (${RELAY_URL})`;
  const socket = new WebSocket(RELAY_URL);
  relaySocket = socket;

  socket.on("open", () => {
    if (relaySocket !== socket) {
      return;
    }
    reconnectAttempt = 0;
    relayStatus = `connected (${RELAY_URL})`;
    lastSocketEvent = `connected to ${RELAY_URL}`;
  });

  socket.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as unknown;
      handleIncoming(parsed);
    } catch {
      lastSocketEvent = "received non-JSON payload";
    }
  });

  socket.on("close", () => {
    if (relaySocket === socket) {
      relaySocket = null;
    }

    if (isShuttingDown) {
      return;
    }

    relayStatus = `disconnected (${RELAY_URL})`;
    extensionStatus = "waiting for extension status";
    lastSocketEvent = "waiting for move-harness relay";
    scheduleReconnect();
  });

  socket.on("error", (error) => {
    if (relaySocket !== socket || isShuttingDown) {
      return;
    }
    lastSocketEvent = `relay error: ${error.message}`;
  });
}

function startRenderLoop(): void {
  if (renderTimer) {
    return;
  }

  renderTimer = setInterval(() => {
    drawWatcherScreen();
  }, 1000);

  drawWatcherScreen();
}

function shutdown(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  if (renderTimer) {
    clearInterval(renderTimer);
    renderTimer = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (relaySocket && (relaySocket.readyState === WebSocket.OPEN || relaySocket.readyState === WebSocket.CONNECTING)) {
    relaySocket.close();
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown();
});

startRenderLoop();
connectRelay();
