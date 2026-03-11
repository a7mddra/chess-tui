import { randomUUID } from "node:crypto";
import process from "node:process";

import { WebSocket, WebSocketServer } from "ws";

const PORT = 8765;
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_PREFIX = "__hb_clock__";

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

const wsServer = new WebSocketServer({ port: PORT });
let extensionSocket: WebSocket | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let renderTimer: NodeJS.Timeout | null = null;

let latestSnapshot: GameClockSnapshot | null = null;
let latestFen: string | null = null;
let connectionStatus = "waiting for extension";
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
  process.stdout.write("Chess.com Clock Watcher (move-triggered snapshots + local ticking)\n");
  process.stdout.write(`WS: ${connectionStatus}\n`);
  process.stdout.write(`Socket: ${lastSocketEvent}\n`);

  if (!latestSnapshot) {
    process.stdout.write("\nWaiting for first game snapshot...\n");
    process.stdout.write("Tip: make a move on chess.com to trigger snapshot update.\n");
    return;
  }

  latestFen = latestSnapshot.fen ?? latestFen;
  const userClock = computeDisplayClock(latestSnapshot.user, now, latestSnapshot.takenAt);
  const opponentClock = computeDisplayClock(latestSnapshot.opponent, now, latestSnapshot.takenAt);

  process.stdout.write(`Latest FEN: ${latestFen ?? "n/a"}\n`);
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

function sendHeartbeatPing(): void {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  extensionSocket.send(
    JSON.stringify({
      type: "ping",
      requestId: `${HEARTBEAT_PREFIX}${randomUUID()}`
    })
  );
}

function handleIncoming(raw: unknown): void {
  if (typeof raw !== "object" || raw === null || typeof (raw as { type?: unknown }).type !== "string") {
    return;
  }

  const message = raw as IncomingMessage;

  switch (message.type) {
    case "status": {
      connectionStatus = `${message.status}${message.detail ? ` (${message.detail})` : ""}`;
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
      if (message.requestId?.startsWith(HEARTBEAT_PREFIX)) {
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

function startRenderLoop(): void {
  if (renderTimer) {
    return;
  }

  renderTimer = setInterval(() => {
    drawWatcherScreen();
  }, 1000);

  drawWatcherScreen();
}

wsServer.on("connection", (socket, request) => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  extensionSocket = socket;
  connectionStatus = "connected";
  lastSocketEvent = `connected from ${request.socket.remoteAddress ?? "unknown"}`;

  heartbeatTimer = setInterval(() => {
    sendHeartbeatPing();
  }, HEARTBEAT_INTERVAL_MS);

  socket.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as unknown;
      handleIncoming(parsed);
    } catch {
      lastSocketEvent = "received non-JSON payload";
    }
  });

  socket.on("close", () => {
    if (extensionSocket === socket) {
      extensionSocket = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    connectionStatus = "disconnected";
    lastSocketEvent = "extension disconnected";
  });

  socket.on("error", (error) => {
    lastSocketEvent = `socket error: ${error.message}`;
  });
});

wsServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    process.stdout.write(`\n[watcher] port ${PORT} is already in use. Stop the other test harness and retry.\n`);
    process.exit(1);
  }

  process.stdout.write(`\n[watcher] websocket server error: ${error.message}\n`);
  process.exit(1);
});

function shutdown(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  if (renderTimer) {
    clearInterval(renderTimer);
    renderTimer = null;
  }

  if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
    extensionSocket.close();
  }

  wsServer.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  shutdown();
});

startRenderLoop();
