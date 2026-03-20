export const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

export type CommandInteraction = "new" | "resign" | "draw" | "accept" | "decline";

export type WsInboundMessage =
  | {
      type: "move";
      uci: string;
      requestId?: string;
    }
  | {
      type: "interaction";
      command: CommandInteraction;
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
      type: "game-state";
      snapshot: GameClockSnapshot;
    }
  | {
      type: "pong";
      requestId?: string;
      ts: number;
    }
  | {
      type: "game-over";
      resultMessage: string;
    }
  | {
      type: "draw-offered";
    }
  | {
      type: "game-url";
      url: string;
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

export interface ApplyInteractionCommand {
  type: "APPLY_INTERACTION";
  command: CommandInteraction;
  requestId: string;
}

export interface ApplyMoveResponse {
  ok: boolean;
  fen?: string;
  error?: string;
}

export interface ApplyInteractionResponse {
  ok: boolean;
  error?: string;
}

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

export type ContentToBackgroundMessage =
  | {
      type: "TAB_READY";
      href: string;
      fen?: string;
      snapshot?: GameClockSnapshot;
    }
  | {
      type: "FEN_UPDATE";
      fen: string;
      snapshot?: GameClockSnapshot;
    }
  | {
      type: "GAME_OVER";
      resultMessage: string;
    }
  | {
      type: "DRAW_OFFERED";
    };

export type ContentHealthcheckMessage = {
  type: "HEALTHCHECK";
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

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

  if (data.type === "interaction") {
    return {
      type: "interaction",
      command: data.command as CommandInteraction,
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

export function isApplyInteractionCommand(value: unknown): value is ApplyInteractionCommand {
  const data = asRecord(value);
  if (!data) return false;
  return (
    data.type === "APPLY_INTERACTION" &&
    typeof data.command === "string" &&
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
    const hasBaseFields =
      typeof data.href === "string" &&
      (typeof data.fen === "string" || typeof data.fen === "undefined");
    if (!hasBaseFields) {
      return false;
    }

    return typeof data.snapshot === "undefined" || isGameClockSnapshot(data.snapshot);
  }

  if (data.type === "FEN_UPDATE") {
    if (typeof data.fen !== "string") {
      return false;
    }

    return typeof data.snapshot === "undefined" || isGameClockSnapshot(data.snapshot);
  }

  if (data.type === "GAME_OVER" && typeof data.resultMessage === "string") {
    return true;
  }

  if (data.type === "DRAW_OFFERED") {
    return true;
  }

  return false;
}

function isPlayerPlacement(value: unknown): value is "top" | "bottom" {
  return value === "top" || value === "bottom";
}

export function isPlayerClockSnapshot(value: unknown): value is PlayerClockSnapshot {
  const data = asRecord(value);
  if (!data) {
    return false;
  }

  return (
    (typeof data.username === "string" || data.username === null) &&
    (typeof data.nationality === "string" || data.nationality === null) &&
    (typeof data.elo === "number" || data.elo === null) &&
    (typeof data.clockText === "string" || data.clockText === null) &&
    (typeof data.clockMs === "number" || data.clockMs === null) &&
    typeof data.isTurn === "boolean" &&
    isPlayerPlacement(data.placement)
  );
}

export function isGameClockSnapshot(value: unknown): value is GameClockSnapshot {
  const data = asRecord(value);
  if (!data) {
    return false;
  }

  return (
    asOptionalNumber(data.takenAt) !== undefined &&
    (typeof data.fen === "string" || data.fen === null) &&
    isPlayerClockSnapshot(data.user) &&
    isPlayerClockSnapshot(data.opponent) &&
    (typeof data.boardOrientation === "undefined" || data.boardOrientation === "w" || data.boardOrientation === "b")
  );
}
