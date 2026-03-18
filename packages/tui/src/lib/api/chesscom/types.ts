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

export type ExtensionInboundMessage =
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

export type ExtensionOutboundMessage = {
  type: "move";
  uci: string;
  requestId: string;
};

export type RelayMessage =
  | ExtensionInboundMessage
  | {
      type: "status";
      status: "connected" | "disconnected";
      detail: string;
    };

export type BridgeState = {
  extensionConnection: "connected" | "disconnected";
  extensionStatus: string;
  relayStatus: string;
  socketEvent: string;
  latestFen: string | null;
  latestSnapshot: GameClockSnapshot | null;
  lastError: string | null;
};

export type MoveResult = {
  ok: boolean;
  fen?: string;
  error?: string;
};

export type PendingMove = {
  resolve: (result: MoveResult) => void;
  timer: NodeJS.Timeout;
};

export type DerivedOnlineState = {
  players: {
    top: {
      name: string;
      elo: number | null;
      clock: string;
      captured: string;
      advantage: string;
    };
    bottom: {
      name: string;
      elo: number | null;
      clock: string;
      captured: string;
      advantage: string;
    };
  } | null;
  activePlacement: "top" | "bottom" | null;
  userPlacement: "top" | "bottom" | null;
  boardOrientation: "w" | "b" | null;
  orientationReady: boolean;
};
