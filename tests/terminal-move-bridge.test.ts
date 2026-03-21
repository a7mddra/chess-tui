import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { WebSocket, WebSocketServer } from "ws";

const EXTENSION_PORT = 8765;
const RELAY_PORT = 8766;
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
const HEARTBEAT_INTERVAL_MS = 15000;
const HEARTBEAT_PREFIX = "__hb__";

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
      type: "move-result";
      requestId: string;
      ok: boolean;
      fen?: string;
      error?: string;
    }
  | {
      type: "pong";
      requestId?: string;
      ts: number;
    }
  | {
      type: "error";
      error: string;
      requestId?: string;
    };

type PendingMove = {
  uci: string;
  sentAt: number;
};

const pendingMoves = new Map<string, PendingMove>();
const wsServer = new WebSocketServer({ port: EXTENSION_PORT });
const relayServer = new WebSocketServer({ port: RELAY_PORT });
const relayClients = new Set<WebSocket>();
let extensionSocket: WebSocket | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

const terminal = createInterface({
  input: stdin,
  output: stdout,
  terminal: true,
});

function log(line: string): void {
  stdout.write(`${line}\n`);
}

function printHelp(): void {
  log("");
  log("Commands:");
  log("  e2e4        -> send UCI move to extension");
  log("  ping        -> test connection with extension");
  log("  help        -> show this help");
  log("  quit/exit   -> close program");
  log("");
}

function printPrompt(): void {
  terminal.setPrompt("move> ");
  terminal.prompt();
}

function sendJson(payload: Record<string, unknown>): void {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN) {
    log("[bridge] extension not connected. Load extension and open chess.com.");
    return;
  }

  extensionSocket.send(JSON.stringify(payload));
}

function relay(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  for (const client of relayClients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }
    client.send(body);
  }
}

function relayStatus(
  status: "connected" | "disconnected",
  detail: string,
): void {
  relay({
    type: "status",
    status,
    detail,
  });
}

function handleIncoming(raw: unknown): void {
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as { type?: unknown }).type !== "string"
  ) {
    log("[ext] ignoring malformed message.");
    return;
  }

  const message = raw as IncomingMessage;
  relay(message as unknown as Record<string, unknown>);

  switch (message.type) {
    case "status":
      log(
        `[ext] status=${message.status}${message.detail ? ` (${message.detail})` : ""}`,
      );
      return;
    case "fen":
      log(`[fen] ${message.fen}`);
      return;
    case "move-result": {
      const pending = pendingMoves.get(message.requestId);
      if (pending) {
        pendingMoves.delete(message.requestId);
      }
      const elapsed = pending ? `${Date.now() - pending.sentAt}ms` : "n/a";
      if (message.ok) {
        log(
          `[move] ${pending?.uci ?? message.requestId} applied in ${elapsed}`,
        );
        if (message.fen) {
          log(`[fen] ${message.fen}`);
        }
      } else {
        log(`[move] failed (${elapsed}): ${message.error ?? "Unknown error"}`);
      }
      return;
    }
    case "pong":
      if (message.requestId?.startsWith(HEARTBEAT_PREFIX)) {
        return;
      }
      log(`[pong] ${new Date(message.ts).toISOString()}`);
      return;
    case "error":
      log(`[ext:error] ${message.error}`);
      return;
    default:
      return;
  }
}

wsServer.on("connection", (socket, request) => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  extensionSocket = socket;
  const remoteAddress = request.socket.remoteAddress ?? "unknown";
  log(`[bridge] extension connected from ${remoteAddress}`);
  relayStatus("connected", `Extension socket connected from ${remoteAddress}.`);
  printPrompt();

  heartbeatTimer = setInterval(() => {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    sendJson({
      type: "ping",
      requestId: `${HEARTBEAT_PREFIX}${randomUUID()}`,
    });
  }, HEARTBEAT_INTERVAL_MS);

  socket.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString()) as unknown;
      handleIncoming(parsed);
    } catch {
      log(`[ext] non-JSON message: ${data.toString()}`);
    }
    printPrompt();
  });

  socket.on("close", () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (extensionSocket === socket) {
      extensionSocket = null;
    }
    log("[bridge] extension disconnected.");
    relayStatus("disconnected", "Extension socket disconnected.");
    printPrompt();
  });

  socket.on("error", (error) => {
    log(`[bridge] websocket error: ${error.message}`);
    printPrompt();
  });
});

wsServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    log(
      `[bridge] port ${EXTENSION_PORT} is already in use. Stop the other test harness and retry.`,
    );
    process.exit(1);
  }

  log(`[bridge] server error: ${error.message}`);
  process.exit(1);
});

relayServer.on("connection", (socket) => {
  relayClients.add(socket);
  socket.send(
    JSON.stringify({
      type: "status",
      status:
        extensionSocket?.readyState === WebSocket.OPEN
          ? "connected"
          : "disconnected",
      detail: "Attached to move-harness relay stream.",
    }),
  );

  socket.on("close", () => {
    relayClients.delete(socket);
  });

  socket.on("error", () => {
    relayClients.delete(socket);
  });
});

relayServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    log(
      `[relay] port ${RELAY_PORT} is already in use. Stop the other relay consumer and retry.`,
    );
    process.exit(1);
  }

  log(`[relay] server error: ${error.message}`);
  process.exit(1);
});

terminal.on("line", (line) => {
  const input = line.trim().toLowerCase();

  if (!input) {
    printPrompt();
    return;
  }

  if (input === "help") {
    printHelp();
    printPrompt();
    return;
  }

  if (input === "quit" || input === "exit") {
    shutdown();
    return;
  }

  if (input === "ping") {
    sendJson({
      type: "ping",
      requestId: randomUUID(),
    });
    printPrompt();
    return;
  }

  if (!UCI_MOVE_REGEX.test(input)) {
    log(
      `[input] invalid move format: "${input}". Expected like e2e4 or e7e8q.`,
    );
    printPrompt();
    return;
  }

  const requestId = randomUUID();
  pendingMoves.set(requestId, {
    uci: input,
    sentAt: Date.now(),
  });

  sendJson({
    type: "move",
    requestId,
    uci: input,
  });
  printPrompt();
});

terminal.on("SIGINT", () => {
  shutdown();
});

function shutdown(): void {
  log("\nShutting down...");
  terminal.close();
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (extensionSocket && extensionSocket.readyState === WebSocket.OPEN) {
    extensionSocket.close();
  }
  for (const client of relayClients) {
    if (
      client.readyState === WebSocket.OPEN ||
      client.readyState === WebSocket.CONNECTING
    ) {
      client.close();
    }
  }

  let serversLeft = 2;
  const onServerClosed = () => {
    serversLeft -= 1;
    if (serversLeft <= 0) {
      process.exit(0);
    }
  };

  wsServer.close(onServerClosed);
  relayServer.close(onServerClosed);
}

log("Chess TUI move-only harness");
log(`Waiting for extension WebSocket on ws://127.0.0.1:${EXTENSION_PORT}`);
log(`Relay stream for telemetry on ws://127.0.0.1:${RELAY_PORT}`);
log("Type 'help' for commands.");
printPrompt();
