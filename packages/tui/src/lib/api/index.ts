import {
  getCommandsForMode,
  type Command,
  type CommandMode,
} from "../config/commands";
import type { PlayerInfoProps } from "../../features/players/PlayerInfo";
import { PIECES_BY_CODE } from "../../features/board/piece";
export * from "./chesscom/core";

export type ApiPlayer = PlayerInfoProps;

export type GameSnapshot = {
  mode: CommandMode;
  source: "chrome-extension" | "stockfish";
  fen: string;
  players: {
    top: ApiPlayer;
    bottom: ApiPlayer;
  };
  commands: Command[];
};

export const START_FEN =
  "rn1qkbnr/pppb1ppp/3pp3/8/2BPP3/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 6";

export const CHESSCOM_PLAYERS: GameSnapshot["players"] = {
  top: {
    name: "Magnus",
    elo: 2830,
    clock: "22:10",
    captured: [
      PIECES_BY_CODE.b.glyph,
      PIECES_BY_CODE.n.glyph,
      PIECES_BY_CODE.p.glyph,
      PIECES_BY_CODE.p.glyph,
    ].join(""),
    advantage: "",
  },
  bottom: {
    name: "Hikaru",
    elo: 2785,
    clock: "25:10",
    captured: [
      PIECES_BY_CODE.B.glyph,
      PIECES_BY_CODE.N.glyph,
      PIECES_BY_CODE.R.glyph,
    ].join(""),
    advantage: "+3",
  },
};

export const STOCKFISH_PLAYERS: GameSnapshot["players"] = {
  top: {
    name: "Player 2",
    elo: 3550,
    clock: "00:00",
    captured: "",
    advantage: "",
  },
  bottom: {
    name: "Player 1",
    elo: 3220,
    clock: "00:00",
    captured: "",
    advantage: "",
  },
};

export const getMockGameSnapshot = (mode: CommandMode): GameSnapshot => {
  if (mode === "stockfish") {
    return {
      mode,
      source: "stockfish",
      fen: START_FEN,
      players: STOCKFISH_PLAYERS,
      commands: getCommandsForMode(mode),
    };
  }

  return {
    mode,
    source: "chrome-extension",
    fen: START_FEN,
    players: CHESSCOM_PLAYERS,
    commands: getCommandsForMode(mode),
  };
};
