import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_BOARD_THEME_ID, type BoardThemeId } from "../config/palette";

export type UserPreferences = {
  boardTheme: BoardThemeId;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  boardTheme: DEFAULT_BOARD_THEME_ID,
};

function resolveConfigRoot(): string {
  if (platform() === "win32") {
    const appData = process.env.APPDATA;
    if (appData && appData.trim().length > 0) {
      return appData;
    }

    return join(homedir(), "AppData", "Roaming");
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim().length > 0) {
    return xdgConfigHome;
  }

  return join(homedir(), ".config");
}

function resolvePreferencesPath(): string {
  return join(resolveConfigRoot(), "chess-tui", "preferences.json");
}

function isBoardThemeId(value: unknown): value is BoardThemeId {
  return value === "default" || value === "sea" || value === "wood" || value === "glassy";
}

export function loadUserPreferences(): UserPreferences {
  const path = resolvePreferencesPath();

  if (!existsSync(path)) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    return {
      boardTheme: isBoardThemeId(raw.boardTheme) ? raw.boardTheme : DEFAULT_PREFERENCES.boardTheme,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(next: Partial<UserPreferences>): UserPreferences {
  const current = loadUserPreferences();
  const merged: UserPreferences = {
    ...current,
    ...next,
  };

  const path = resolvePreferencesPath();
  const dir = dirname(path);

  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n", "utf8");

  return merged;
}
