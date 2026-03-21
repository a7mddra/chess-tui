// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

const IS_MAC = process.platform === "darwin";

export type Shortcut = {
  label: string;
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
  { label: "Back to welcome", keys: "Tab" },
  { label: "Deselect piece", keys: "Esc" },
  { label: "Undo last move", keys: mod("z") },
  { label: "Detach board", keys: mod("d") },
  { label: "Exit program", keys: mod("c") },
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
