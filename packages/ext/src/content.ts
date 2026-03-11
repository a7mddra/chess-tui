import {
  isApplyMoveCommand,
  type ApplyMoveResponse
} from "./protocol";

const CONTENT_SOURCE = "chess-tui-content";
const PAGE_SOURCE = "chess-tui-page";
const BRIDGE_SCRIPT_FILE = "page-bridge.js";
const MOVE_TIMEOUT_MS = 5000;

type PendingRequest = {
  sendResponse: (response: ApplyMoveResponse) => void;
  timeoutId: number;
};

const pendingRequests = new Map<string, PendingRequest>();

function injectBridgeScript(): void {
  const marker = "__CHESS_TUI_BRIDGE_INJECTED__";
  const bridgeWindow = window as Window & {
    [marker]?: boolean;
  };

  if (bridgeWindow[marker]) {
    return;
  }

  bridgeWindow[marker] = true;

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL(BRIDGE_SCRIPT_FILE);
  script.async = false;
  script.dataset.bridge = "chess-tui";

  const target = document.head ?? document.documentElement;
  target.appendChild(script);
  script.onload = () => {
    script.remove();
  };
}

function postToPage(message: Record<string, unknown>): void {
  window.postMessage(
    {
      source: CONTENT_SOURCE,
      target: PAGE_SOURCE,
      ...message
    },
    "*"
  );
}

function handleMoveTimeout(requestId: string): void {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }

  pendingRequests.delete(requestId);
  pending.sendResponse({
    ok: false,
    error: "Timed out waiting for board response."
  });
}

function notifyBackgroundReady(fen?: string): void {
  void chrome.runtime.sendMessage({
    type: "TAB_READY",
    href: window.location.href,
    fen
  });
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message === "object" && message !== null && (message as { type?: unknown }).type === "HEALTHCHECK") {
    sendResponse({
      ok: true,
      href: window.location.href
    });
    return;
  }

  if (!isApplyMoveCommand(message)) {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    handleMoveTimeout(message.requestId);
  }, MOVE_TIMEOUT_MS);

  pendingRequests.set(message.requestId, {
    sendResponse,
    timeoutId
  });

  postToPage({
    type: "APPLY_MOVE",
    requestId: message.requestId,
    uci: message.uci
  });

  return true;
});

window.addEventListener("message", (event) => {
  if (event.source !== window || typeof event.data !== "object" || event.data === null) {
    return;
  }

  const data = event.data as Record<string, unknown>;
  if (data.source !== PAGE_SOURCE || data.target !== CONTENT_SOURCE || typeof data.type !== "string") {
    return;
  }

  if (data.type === "MOVE_RESULT" && typeof data.requestId === "string") {
    const pending = pendingRequests.get(data.requestId);
    if (!pending) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    pendingRequests.delete(data.requestId);

    pending.sendResponse({
      ok: data.ok === true,
      fen: typeof data.fen === "string" ? data.fen : undefined,
      error: typeof data.error === "string" ? data.error : undefined
    });
    return;
  }

  if (data.type === "FEN_UPDATE" && typeof data.fen === "string") {
    void chrome.runtime.sendMessage({
      type: "FEN_UPDATE",
      fen: data.fen
    });
    return;
  }

  if (data.type === "BRIDGE_READY") {
    notifyBackgroundReady(typeof data.fen === "string" ? data.fen : undefined);
  }
});

window.addEventListener("beforeunload", () => {
  for (const [requestId, pending] of pendingRequests) {
    window.clearTimeout(pending.timeoutId);
    pending.sendResponse({
      ok: false,
      error: "Tab navigated before move completion."
    });
    pendingRequests.delete(requestId);
  }
});

injectBridgeScript();
notifyBackgroundReady();
