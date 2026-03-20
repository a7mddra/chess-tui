import { useEffect, useMemo, useState } from "react";
import type { ApiPlayer } from "../index";
import { BRIDGE_WS_URL, onlineBridge } from "./bridge";
import { deriveOnlineState } from "./snapshot";
import type { BridgeState, MoveResult, CommandInteraction } from "./types";

export type OnlineGameView = {
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
  gameUrl: string | null;
  lastGameOver: string | null;
  lastDrawOfferedAt: number | null;
  sendMove: (uci: string) => Promise<MoveResult>;
  sendInteraction: (command: CommandInteraction) => Promise<MoveResult>;
};

export const useOnlineGame = (enabled: boolean): OnlineGameView => {
  const [state, setState] = useState<BridgeState>(() => onlineBridge.getState());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    onlineBridge.start();
    const unsubscribe = onlineBridge.subscribe(setState);

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

  const derived = useMemo(
    () => deriveOnlineState(state.latestSnapshot, state.latestFen, nowMs, state.lastGameOver !== null),
    [state.latestSnapshot, state.latestFen, nowMs, state.lastGameOver],
  );

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
    gameUrl: state.gameUrl,
    lastGameOver: state.lastGameOver,
    lastDrawOfferedAt: state.lastDrawOfferedAt,
    sendMove: (uci: string) => onlineBridge.sendMove(uci),
    sendInteraction: (cmd: CommandInteraction) => onlineBridge.sendInteraction(cmd),
  };
};
