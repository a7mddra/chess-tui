export const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

export type WsInboundMessage =
  | {
      type: "move";
      uci: string;
      requestId?: string;
    }
  | {
      type: "ping";
      requestId?: string;
    };

export type WsOutboundMessage =
  | {
      type: "status";
      status: "connected" | "disconnected";
      detail?: string;
    }
  | {
      type: "move-result";
      requestId: string;
      ok: boolean;
      fen?: string;
      error?: string;
    }
  | {
      type: "fen";
      fen: string;
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

export interface ApplyMoveCommand {
  type: "APPLY_MOVE";
  uci: string;
  requestId: string;
}

export interface ApplyMoveResponse {
  ok: boolean;
  fen?: string;
  error?: string;
}

export type ContentToBackgroundMessage =
  | {
      type: "TAB_READY";
      href: string;
      fen?: string;
    }
  | {
      type: "FEN_UPDATE";
      fen: string;
    };

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as UnknownRecord;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseWsInbound(value: unknown): WsInboundMessage | null {
  const data = asRecord(value);
  if (!data || typeof data.type !== "string") {
    return null;
  }

  if (data.type === "move") {
    if (typeof data.uci !== "string" || !UCI_MOVE_REGEX.test(data.uci)) {
      return null;
    }

    return {
      type: "move",
      uci: data.uci.toLowerCase(),
      requestId: asOptionalString(data.requestId)
    };
  }

  if (data.type === "ping") {
    return {
      type: "ping",
      requestId: asOptionalString(data.requestId)
    };
  }

  return null;
}

export function isApplyMoveCommand(value: unknown): value is ApplyMoveCommand {
  const data = asRecord(value);
  if (!data) {
    return false;
  }

  return (
    data.type === "APPLY_MOVE" &&
    typeof data.uci === "string" &&
    UCI_MOVE_REGEX.test(data.uci) &&
    typeof data.requestId === "string"
  );
}

export function isContentToBackgroundMessage(
  value: unknown
): value is ContentToBackgroundMessage {
  const data = asRecord(value);
  if (!data || typeof data.type !== "string") {
    return false;
  }

  if (data.type === "TAB_READY") {
    return (
      typeof data.href === "string" &&
      (typeof data.fen === "string" || typeof data.fen === "undefined")
    );
  }

  if (data.type === "FEN_UPDATE") {
    return typeof data.fen === "string";
  }

  return false;
}
