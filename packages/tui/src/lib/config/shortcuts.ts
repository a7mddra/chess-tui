const IS_MAC = process.platform === "darwin";

export type Shortcut = {
  /** Human-readable label (e.g. "Detach board") */
  label: string;
  /** Display string for the key combo (e.g. "⌘D" on Mac, "Ctrl+D" on Linux) */
  keys: string;
};

const mod = (key: string): string =>
  IS_MAC ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;

const opt = (key: string): string =>
  IS_MAC ? `⌥${key.toUpperCase()}` : `Alt+${key.toUpperCase()}`;

export const SHORTCUTS: Shortcut[] = [
  { label: "Exit program", keys: mod("c") },
  { label: "Back to welcome", keys: "Esc" },
  { label: "Detach board", keys: mod("d") },
  { label: "Undo last move", keys: mod("z") },
];

export const formatShortcutLines = (): string[] =>
  SHORTCUTS.map((s) => `${s.keys.padEnd(10)} ${s.label}`);

export { IS_MAC, mod, opt };
