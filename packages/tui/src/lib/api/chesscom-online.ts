import { randomUUID } from "node:crypto";
import { useEffect, useMemo, useState } from "react";
import { WebSocket, WebSocketServer } from "ws";
import { PIECE_POWER } from "../../features/board/generation";
import type { ApiPlayer } from "./index";

const EXTENSION_PORT = 8765;
const RELAY_PORT = 8766;
const BRIDGE_WS_URL = `ws://127.0.0.1:${EXTENSION_PORT}`;
const MOVE_TIMEOUT_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 15000;
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

export type PlayerClockSnapshot = {
  username: string | null;
  nationality: string | null;
  elo: number | null;
  clockText: string | null;
  clockMs: number | null;
  isTurn: boolean;
  placement: "top" | "bottom";
};

export type GameClockSnapshot = {
  takenAt: number;
  fen: string | null;
  user: PlayerClockSnapshot;
  opponent: PlayerClockSnapshot;
  boardOrientation?: "w" | "b";
};

type ExtensionInboundMessage =
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
      requestId?: string;
      error: string;
    };

type ExtensionOutboundMessage =
  | {
      type: "move";
      uci: string;
      requestId: string;
    };

type RelayMessage =
  | ExtensionInboundMessage
  | {
      type: "status";
      status: "connected" | "disconnected";
      detail: string;
    };

type BridgeState = {
  extensionConnection: "connected" | "disconnected";
  extensionStatus: string;
  relayStatus: string;
  socketEvent: string;
  latestFen: string | null;
  latestSnapshot: GameClockSnapshot | null;
  lastError: string | null;
};

type PendingMove = {
  resolve: (result: { ok: boolean; fen?: string; error?: string }) => void;
  timer: NodeJS.Timeout;
};

const initialBridgeState: BridgeState = {
  extensionConnection: "disconnected",
  extensionStatus: "waiting for extension status",
  relayStatus: `listening on ws://127.0.0.1:${RELAY_PORT}`,
  socketEvent: `waiting for extension connection on ws://127.0.0.1:${EXTENSION_PORT}`,
  latestFen: null,
  latestSnapshot: null,
  lastError: null,
};

class ChesscomBridge {
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

  subscribe(listener: (state: BridgeState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async sendMove(uci: string): Promise<{ ok: boolean; fen?: string; error?: string }> {
    const normalized = uci.trim().toLowerCase();

    if (!UCI_MOVE_REGEX.test(normalized)) {
      return {
        ok: false,
        error: `Invalid UCI: ${uci}`,
      };
    }

    if (!this.extensionSocket || this.extensionSocket.readyState !== WebSocket.OPEN) {
      return {
        ok: false,
        error: "Extension bridge is not connected.",
      };
    }

    const requestId = randomUUID();

    return await new Promise<{ ok: boolean; fen?: string; error?: string }>((resolve) => {
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

        this.flushPendingMoves("Extension disconnected before move acknowledgement.");
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
          status: this.extensionSocket?.readyState === WebSocket.OPEN ? "connected" : "disconnected",
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
    if (typeof raw !== "object" || raw === null || typeof (raw as { type?: unknown }).type !== "string") {
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
      if (!this.extensionSocket || this.extensionSocket.readyState !== WebSocket.OPEN) {
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

const chesscomBridge = new ChesscomBridge();

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

const PIECE_SYMBOLS: Record<SideColor, Record<PieceCode, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

type MaterialStats = {
  capturedBy: Record<SideColor, Record<PieceCode, number>>;
  score: Record<SideColor, number>;
};

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

function renderCaptured(captured: Record<PieceCode, number>, targetColor: SideColor): string {
  const symbols: string[] = [];

  for (const piece of CAPTURE_RENDER_ORDER) {
    const count = captured[piece];
    for (let i = 0; i < count; i += 1) {
      symbols.push(PIECE_SYMBOLS[targetColor][piece]);
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
  const name = rawName
    .replace(/^[\s\u2654-\u265f]+/u, "")
    .trim() || "n/a";

  return {
    name,
    elo: player.elo,
    clock,
    captured,
    advantage,
  };
}

export type ChesscomOnlineView = {
  fen: string | null;
  players: {
    top: ApiPlayer;
    bottom: ApiPlayer;
  } | null;
  activePlacement: "top" | "bottom" | null;
  userPlacement: "top" | "bottom" | null;
  boardOrientation: "w" | "b" | null;
  orientationReady: boolean;
  bridgeConnection: "connected" | "disconnected";
  bridgeEndpoint: string;
  extensionStatus: string;
  relayStatus: string;
  socketEvent: string;
  sendMove: (uci: string) => Promise<{ ok: boolean; fen?: string; error?: string }>;
};

export const useChesscomOnlineGame = (enabled: boolean): ChesscomOnlineView => {
  const [state, setState] = useState<BridgeState>(initialBridgeState);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    chesscomBridge.start();
    const unsubscribe = chesscomBridge.subscribe(setState);

    return () => {
      unsubscribe();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [enabled]);

  const derived = useMemo(() => {
    if (!state.latestSnapshot) {
      return {
        players: null,
        activePlacement: null,
        userPlacement: null,
        boardOrientation: null,
        orientationReady: false,
      };
    }

    const snapshot = state.latestSnapshot;
    const userClock = computeDisplayClock(snapshot.user, nowMs, snapshot.takenAt);
    const opponentClock = computeDisplayClock(snapshot.opponent, nowMs, snapshot.takenAt);

    const topSource = snapshot.user.placement === "top" ? snapshot.user : snapshot.opponent;
    const bottomSource = snapshot.user.placement === "bottom" ? snapshot.user : snapshot.opponent;

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

    const material = parseFenMaterial(snapshot.fen ?? state.latestFen);

    const userNameReady = typeof snapshot.user.username === "string" && snapshot.user.username.trim().length > 0;
    const opponentNameReady = typeof snapshot.opponent.username === "string" && snapshot.opponent.username.trim().length > 0;
    const orientationReady = userNameReady && opponentNameReady && boardOrientation !== null;

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
        bottom: toApiPlayer(bottomSource, bottomClock, bottomCaptured, bottomAdvantage),
      },
      activePlacement,
      userPlacement: snapshot.user.placement,
      boardOrientation,
      orientationReady,
    };
  }, [state.latestSnapshot, state.latestFen, nowMs]);

  return {
    fen: state.latestSnapshot?.fen ?? state.latestFen,
    players: derived.players,
    activePlacement: derived.activePlacement,
    userPlacement: derived.userPlacement,
    boardOrientation: derived.boardOrientation,
    orientationReady: derived.orientationReady,
    bridgeConnection: state.extensionConnection,
    bridgeEndpoint: BRIDGE_WS_URL,
    extensionStatus: state.extensionStatus,
    relayStatus: state.relayStatus,
    socketEvent: state.socketEvent,
    sendMove: (uci: string) => chesscomBridge.sendMove(uci),
  };
};
