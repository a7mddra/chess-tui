export type Command = {
  name: string;
  description: string;
};

export const COMMANDS: Command[] = [
  { name: "/new", description: "Start new game" },
  { name: "/undo", description: "Undo last move" },
  { name: "/resign", description: "Resign game" },
  { name: "/draw", description: "Offer draw" },
  { name: "/accept", description: "Accept draw offer" },
  { name: "/decline", description: "Decline draw offer" },
  { name: "/analyze", description: "Analyze game" },
  { name: "/flip", description: "Flip board" },
  { name: "/difficulty", description: "Set difficulty" },
  { name: "/exit", description: "Exit program" },
];
