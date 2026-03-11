import {
  isContentToBackgroundMessage,
  parseWsInbound,
  type ApplyMoveCommand,
  type ApplyMoveResponse,
  type WsOutboundMessage
} from "./protocol";

const WS_URL_CANDIDATES = [
  "ws://127.0.0.1:8765",
  "ws://localhost:8765"
] as const;
const CHESS_URL_MATCH = ["*://*.chess.com/*"];
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000, 10000] as const;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let wsUrlIndex = 0;
const readyTabIds = new Set<number>();

function sendToSocket(message: WsOutboundMessage): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
}

function connectSocket(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const wsUrl = WS_URL_CANDIDATES[wsUrlIndex] ?? WS_URL_CANDIDATES[0];
  socket = new WebSocket(wsUrl);

  socket.addEventListener("open", () => {
    reconnectAttempt = 0;
    sendToSocket({
      type: "status",
      status: "connected",
      detail: `Extension bridge connected (${wsUrl}).`
    });
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") {
      return;
    }

    void handleSocketPayload(event.data);
  });

  socket.addEventListener("error", () => {
    // The browser keeps error details opaque for WS. Close proactively to trigger retries.
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    wsUrlIndex = (wsUrlIndex + 1) % WS_URL_CANDIDATES.length;
    scheduleReconnect();
  });
}

function scheduleReconnect(): void {
  const index = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
  const delay = RECONNECT_DELAYS_MS[index];
  reconnectAttempt += 1;

  setTimeout(() => {
    connectSocket();
  }, delay);
}

async function handleSocketPayload(payload: string): Promise<void> {
  let rawMessage: unknown;

  try {
    rawMessage = JSON.parse(payload);
  } catch {
    sendToSocket({
      type: "error",
      error: "Invalid JSON payload."
    });
    return;
  }

  const message = parseWsInbound(rawMessage);
  if (!message) {
    sendToSocket({
      type: "error",
      error: "Unsupported message. Use {type:\"move\", uci:\"e2e4\"} or {type:\"ping\"}."
    });
    return;
  }

  if (message.type === "ping") {
    sendToSocket({
      type: "pong",
      requestId: message.requestId,
      ts: Date.now()
    });
    return;
  }

  const requestId = message.requestId ?? crypto.randomUUID();
  const result = await applyMoveToBestTab(message.uci, requestId);

  sendToSocket({
    type: "move-result",
    requestId,
    ok: result.ok,
    fen: result.fen,
    error: result.error
  });
}

async function applyMoveToBestTab(uci: string, requestId: string): Promise<ApplyMoveResponse> {
  const tabId = await resolveTargetTab();
  if (tabId === null) {
    return {
      ok: false,
      error:
        "No chess.com tab receiver is ready. Reload your chess.com game tab after enabling the extension."
    };
  }

  const command: ApplyMoveCommand = {
    type: "APPLY_MOVE",
    uci,
    requestId
  };

  return sendMoveToTab(tabId, command);
}

async function resolveTargetTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: CHESS_URL_MATCH });
  if (!tabs.length) {
    return null;
  }

  const candidates = [
    ...tabs
      .filter((tab) => tab.active && typeof tab.id === "number")
      .map((tab) => tab.id as number),
    ...tabs
      .filter((tab) => typeof tab.id === "number" && readyTabIds.has(tab.id))
      .map((tab) => tab.id as number),
    ...tabs
      .filter((tab) => typeof tab.id === "number")
      .map((tab) => tab.id as number)
  ];

  const dedupedCandidates = [...new Set(candidates)];
  for (const tabId of dedupedCandidates) {
    const hasReceiver = await checkContentReceiver(tabId);
    if (hasReceiver) {
      readyTabIds.add(tabId);
      return tabId;
    }
  }

  return null;
}

function checkContentReceiver(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "HEALTHCHECK"
      },
      (response?: { ok?: boolean }) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          resolve(false);
          return;
        }

        resolve(response?.ok === true);
      }
    );
  });
}

function sendMoveToTab(tabId: number, message: ApplyMoveCommand): Promise<ApplyMoveResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response?: ApplyMoveResponse) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        readyTabIds.delete(tabId);
        const isNoReceiver = runtimeError.message?.includes("Receiving end does not exist");
        resolve({
          ok: false,
          error: isNoReceiver
            ? "Tab receiver unavailable. Refresh the chess.com tab and retry."
            : runtimeError.message
        });
        return;
      }

      if (!response || typeof response.ok !== "boolean") {
        resolve({
          ok: false,
          error: "No response from content bridge."
        });
        return;
      }

      resolve(response);
    });
  });
}

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isContentToBackgroundMessage(message)) {
    return;
  }

  if (message.type === "TAB_READY") {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number") {
      readyTabIds.add(tabId);
    }

    if (message.fen) {
      sendToSocket({
        type: "fen",
        fen: message.fen
      });
    }

    if (message.snapshot) {
      sendToSocket({
        type: "game-state",
        snapshot: message.snapshot
      });
    }

    return;
  }

  if (message.type === "FEN_UPDATE") {
    sendToSocket({
      type: "fen",
      fen: message.fen
    });

    if (message.snapshot) {
      sendToSocket({
        type: "game-state",
        snapshot: message.snapshot
      });
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  readyTabIds.delete(tabId);
});

connectSocket();

chrome.runtime.onStartup.addListener(() => {
  connectSocket();
});

chrome.runtime.onInstalled.addListener(() => {
  connectSocket();
});
