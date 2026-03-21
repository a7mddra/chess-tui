// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

export type Command = {
  id: string;
  label: string;
  keywords?: string[];
  mode?: "all" | "online" | "offline";
};

export type CommandMode = "chesscom" | "stockfish";

export const COMMANDS: Command[] = [
  { id: "new", label: "Start new game", keywords: ["new"], mode: "all" },
  { id: "resign", label: "Resign game", mode: "all" },
  { id: "draw", label: "Offer draw", mode: "online" },
  { id: "accept", label: "Accept draw offer", mode: "online" },
  { id: "decline", label: "Decline draw offer", mode: "online" },
  { id: "analyze", label: "Analyze game", mode: "online" },
  { id: "flip", label: "Flip board", mode: "offline" },
  { id: "undo", label: "Undo last move", mode: "offline" },
  {
    id: "diff",
    label: "Set engine elo",
    keywords: ["difficulty", "level"],
    mode: "offline",
  },
  {
    id: "theme",
    label: "Change Theme",
    keywords: ["board", "palette", "skin"],
    mode: "all",
  },
  { id: "exit", label: "Exit program", keywords: ["quit"], mode: "all" },
];

export const getCommandsForMode = (mode: CommandMode): Command[] => {
  const target = mode === "stockfish" ? "offline" : "online";

  return COMMANDS.filter((command) => {
    const commandMode = command.mode ?? "all";
    return commandMode === "all" || commandMode === target;
  });
};
