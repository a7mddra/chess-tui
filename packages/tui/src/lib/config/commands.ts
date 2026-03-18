export type Command = {
  /** Internal ID used by backend logic (e.g. "new", "accept") */
  id: string;
  /** Display label shown in the command list (e.g. "Start new game") */
  label: string;
  /** Extra keywords for search that aren't in the label */
  keywords?: string[];
  /** Where this command is available */
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
  { id: "theme", label: "Change Theme", keywords: ["board", "palette", "skin"], mode: "all" },
  { id: "exit", label: "Exit program", keywords: ["quit"], mode: "all" },
];

export const getCommandsForMode = (mode: CommandMode): Command[] => {
  const target = mode === "stockfish" ? "offline" : "online";

  return COMMANDS.filter((command) => {
    const commandMode = command.mode ?? "all";
    return commandMode === "all" || commandMode === target;
  });
};
