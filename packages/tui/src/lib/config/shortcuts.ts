const IS_MAC = process.platform === "darwin";

export type Shortcut = {
  /** Human-readable label (e.g. "Detach board") */
  label: string;
  /** Display string for the key combo (e.g. "⌘D" on Mac, "Ctrl+D" on Linux) */
  keys: string;
};

type ShortcutOptions = {
  includeUndo?: boolean;
};

const mod = (key: string): string =>
  IS_MAC ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;

const opt = (key: string): string =>
  IS_MAC ? `⌥${key.toUpperCase()}` : `Alt+${key.toUpperCase()}`;

export const SHORTCUTS: Shortcut[] = [
  { label: "Exit program", keys: mod("c") },
  { label: "Back to welcome", keys: "Tab" },
  { label: "Clear piece focus", keys: "Esc" },
  { label: "Detach board", keys: mod("d") },
  { label: "Undo last move", keys: mod("z") },
];

export const formatShortcutLines = (
  options: ShortcutOptions = {},
): string[] => {
  const includeUndo = options.includeUndo ?? true;
  const shortcuts = includeUndo
    ? SHORTCUTS
    : SHORTCUTS.filter((s) => s.label !== "Undo last move");

  return shortcuts.map((s) => `${s.keys.padEnd(10)} ${s.label}`);
};

export { IS_MAC, mod, opt };
