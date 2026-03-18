import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import type {
  BridgeState,
  ExtensionInboundMessage,
  ExtensionOutboundMessage,
  MoveResult,
  PendingMove,
  RelayMessage,
} from "./types";

const EXTENSION_PORT = 8765;
const RELAY_PORT = 8766;
const MOVE_TIMEOUT_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 15000;
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

export const BRIDGE_WS_URL = `ws://127.0.0.1:${EXTENSION_PORT}`;

const initialBridgeState: BridgeState = {
  extensionConnection: "disconnected",
  extensionStatus: "waiting for extension status",
  relayStatus: `listening on ws://127.0.0.1:${RELAY_PORT}`,
  socketEvent: `waiting for extension connection on ws://127.0.0.1:${EXTENSION_PORT}`,
  latestFen: null,
  latestSnapshot: null,
  lastError: null,
};

export class OnlineBridge {
  private extensionServer: WebSocketServer | null = null;
  private relayServer: WebSocketServer | null = null;
  private extensionSocket: WebSocket | null = null;
  private relayClients = new Set<WebSocket>();
  private pendingMoves = new Map<string, PendingMove>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private state: BridgeState = initialBridgeState;
  private listeners = new Set<(state: BridgeState) => void>();

  start(): void {
    if (!this.extensionServer) {
      this.extensionServer = new WebSocketServer({ port: EXTENSION_PORT });
      this.bindExtensionServer(this.extensionServer);
    }

    if (!this.relayServer) {
      this.relayServer = new WebSocketServer({ port: RELAY_PORT });
      this.bindRelayServer(this.relayServer);
    }
  }

  getState(): BridgeState {
    return this.state;
  }

  subscribe(listener: (state: BridgeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async sendMove(uci: string): Promise<MoveResult> {
    const normalized = uci.trim().toLowerCase();

    if (!UCI_MOVE_REGEX.test(normalized)) {
      return {
        ok: false,
        error: `Invalid UCI: ${uci}`,
      };
    }

    if (
      !this.extensionSocket ||
      this.extensionSocket.readyState !== WebSocket.OPEN
    ) {
      return {
        ok: false,
        error: "Extension bridge is not connected.",
      };
    }

    const requestId = randomUUID();

    return await new Promise<MoveResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingMoves.delete(requestId);
        resolve({
          ok: false,
          error: "Timed out waiting for move-result from extension.",
        });
      }, MOVE_TIMEOUT_MS);

      this.pendingMoves.set(requestId, { resolve, timer });

      const payload: ExtensionOutboundMessage = {
        type: "move",
        requestId,
        uci: normalized,
      };

      this.extensionSocket?.send(JSON.stringify(payload), (err) => {
        if (!err) {
          return;
        }

        const pending = this.pendingMoves.get(requestId);
        if (!pending) {
          return;
        }

        clearTimeout(pending.timer);
        this.pendingMoves.delete(requestId);
        resolve({
          ok: false,
          error: err.message,
        });
      });
    });
  }

  private updateState(next: Partial<BridgeState>): void {
    this.state = {
      ...this.state,
      ...next,
    };

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private bindExtensionServer(server: WebSocketServer): void {
    server.on("connection", (socket, request) => {
      this.extensionSocket = socket;
      const remoteAddress = request.socket.remoteAddress ?? "unknown";

      this.updateState({
        extensionConnection: "connected",
        extensionStatus: `connected (Extension bridge connected (ws://127.0.0.1:${EXTENSION_PORT}).)`,
        socketEvent: `connected from ${remoteAddress}`,
      });
      this.startHeartbeat();
      this.broadcastRelay({
        type: "status",
        status: "connected",
        detail: `Extension bridge connected (ws://127.0.0.1:${EXTENSION_PORT}).`,
      });

      socket.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString()) as unknown;
          this.handleExtensionInbound(message);
        } catch {
          this.updateState({ socketEvent: "received non-JSON payload" });
        }
      });

      socket.on("close", () => {
        if (this.extensionSocket === socket) {
          this.extensionSocket = null;
        }

        this.flushPendingMoves(
          "Extension disconnected before move acknowledgement.",
        );
        this.stopHeartbeat();
        this.updateState({
          extensionConnection: "disconnected",
          extensionStatus: "disconnected",
          socketEvent: "extension disconnected",
        });
        this.broadcastRelay({
          type: "status",
          status: "disconnected",
          detail: "Extension socket disconnected.",
        });
      });

      socket.on("error", (error) => {
        this.updateState({
          socketEvent: `extension websocket error: ${error.message}`,
          lastError: error.message,
        });
      });
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      this.updateState({
        relayStatus: `bridge error on ${EXTENSION_PORT}: ${error.message}`,
        lastError: error.message,
      });
    });
  }

  private bindRelayServer(server: WebSocketServer): void {
    server.on("connection", (socket) => {
      this.relayClients.add(socket);

      socket.send(
        JSON.stringify({
          type: "status",
          status:
            this.extensionSocket?.readyState === WebSocket.OPEN
              ? "connected"
              : "disconnected",
          detail: "Attached to TUI relay stream.",
        } satisfies RelayMessage),
      );

      socket.on("close", () => {
        this.relayClients.delete(socket);
      });

      socket.on("error", () => {
        this.relayClients.delete(socket);
      });
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      this.updateState({
        relayStatus: `relay error on ${RELAY_PORT}: ${error.message}`,
        lastError: error.message,
      });
    });
  }

  private handleExtensionInbound(raw: unknown): void {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as { type?: unknown }).type !== "string"
    ) {
      return;
    }

    const message = raw as ExtensionInboundMessage;
    this.broadcastRelay(message);

    switch (message.type) {
      case "status": {
        this.updateState({
          extensionConnection: message.status,
          extensionStatus: `${message.status}${message.detail ? ` (${message.detail})` : ""}`,
        });
        return;
      }
      case "fen": {
        this.updateState({
          latestFen: message.fen,
        });
        return;
      }
      case "game-state": {
        this.updateState({
          latestSnapshot: message.snapshot,
          latestFen: message.snapshot.fen ?? this.state.latestFen,
        });
        return;
      }
      case "move-result": {
        const pending = this.pendingMoves.get(message.requestId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingMoves.delete(message.requestId);
          pending.resolve({
            ok: message.ok,
            fen: message.fen,
            error: message.error,
          });
        }

        if (message.fen) {
          this.updateState({ latestFen: message.fen });
        }

        if (!message.ok && message.error) {
          this.updateState({
            socketEvent: `move failed: ${message.error}`,
            lastError: message.error,
          });
        }

        return;
      }
      case "pong": {
        this.updateState({
          socketEvent: `pong ${new Date(message.ts).toISOString()}`,
        });
        return;
      }
      case "error": {
        this.updateState({
          socketEvent: `error: ${message.error}`,
          lastError: message.error,
        });
        return;
      }
      default:
        return;
    }
  }

  private broadcastRelay(payload: RelayMessage): void {
    const body = JSON.stringify(payload);
    for (const client of this.relayClients) {
      if (client.readyState !== client.OPEN) {
        continue;
      }
      client.send(body);
    }
  }

  private flushPendingMoves(reason: string): void {
    for (const [requestId, pending] of this.pendingMoves.entries()) {
      clearTimeout(pending.timer);
      pending.resolve({
        ok: false,
        error: `${reason} (requestId=${requestId})`,
      });
    }
    this.pendingMoves.clear();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (
        !this.extensionSocket ||
        this.extensionSocket.readyState !== WebSocket.OPEN
      ) {
        return;
      }

      this.extensionSocket.send(
        JSON.stringify({
          type: "ping",
          requestId: `__hb_${Date.now()}`,
        }),
      );
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (!this.heartbeatTimer) {
      return;
    }

    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }
}

export const onlineBridge = new OnlineBridge();
