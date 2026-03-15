export type Command = {
  /** Internal ID used by backend logic (e.g. "new", "accept") */
  id: string;
  /** Display label shown in the command list (e.g. "Start new game") */
  label: string;
  /** Extra keywords for search that aren't in the label */
  keywords?: string[];
};

export const COMMANDS: Command[] = [
  { id: "new", label: "Start new game", keywords: ["new"] },
  { id: "undo", label: "Undo last move" },
  { id: "resign", label: "Resign game" },
  { id: "draw", label: "Offer draw" },
  { id: "accept", label: "Accept draw offer" },
  { id: "decline", label: "Decline draw offer" },
  { id: "analyze", label: "Analyze game" },
  { id: "flip", label: "Flip board" },
  { id: "difficulty", label: "Set difficulty", keywords: ["level"] },
  { id: "exit", label: "Exit program", keywords: ["quit"] },
];
