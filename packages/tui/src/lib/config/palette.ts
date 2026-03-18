export const HEX = {
  white: "#ffffff",
  black: "#000000",
  gray950: "#2a2a2a",
  gray700: "#555555",
  gray600: "#666666",
  gray500: "#888888",
  gray400: "#aaaaaa",
  blueMuted: "#688ba6",
  greenAccent: "#b2e068",
  greenAccentAlt: "#b3e069",
  yellowWarn: "#f5f682",
  logoGray1: "#f5f5f5",
  logoGray2: "#ebebeb",
  logoGray3: "#e1e1e1",
  logoGray4: "#d7d7d7",
  logoGray5: "#cdcdcd",
  logoGreenMid: "#81b64c",
  logoGreenDark: "#5e9949",
  boardDefaultLight: "#ebecd0",
  boardDefaultDark: "#739552",
  boardDefaultHighlightLight: "#f5f682",
  boardDefaultHighlightDark: "#b9ca43",
  boardDefaultPremoveLight: "#af2b2d",
  boardDefaultPremoveDark: "#b02c2c",
  boardDotDark: "#587040",
  boardDotLight: "#c4c4b3",
  captureRed: "#ff0000",
  seaLight: "#d9ebf7",
  seaDark: "#4d86a8",
  seaHighlightLight: "#b7e7ff",
  seaHighlightDark: "#3f9ecf",
  seaPremoveLight: "#f5b8be",
  seaPremoveDark: "#c46f77",
  seaDotDark: "#2f6f92",
  seaDotLight: "#8ab9d4",
  woodLight: "#e8d6bf",
  woodDark: "#9a6f45",
  woodHighlightLight: "#f6e18f",
  woodHighlightDark: "#c7a34a",
  woodPremoveLight: "#d7a5a5",
  woodPremoveDark: "#a05f5f",
  woodDotDark: "#6f4c2d",
  woodDotLight: "#c8aa84",
  glassyLight: "#d7f4ff",
  glassyDark: "#5d8ea3",
  glassyHighlightLight: "#b7ffff",
  glassyHighlightDark: "#5abfd3",
  glassyPremoveLight: "#e1b2d2",
  glassyPremoveDark: "#ac6d95",
  glassyDotDark: "#3f7287",
  glassyDotLight: "#9ec2d0",
} as const;

export const UI_COLORS = {
  accent: HEX.greenAccent,
  border: HEX.gray700,
  spinner: HEX.blueMuted,
  muted: HEX.gray600,
  mutedAlt: HEX.gray400,
  dimBackground: HEX.gray950,
  boardCoords: HEX.gray500,
  warning: HEX.yellowWarn,
  textDefault: HEX.black,
  captureTarget: HEX.captureRed,
  cursorAccent: HEX.greenAccent,
} as const;

export const WELCOME_LOGO_GRADIENT = [
  HEX.white,
  HEX.logoGray1,
  HEX.logoGray2,
  HEX.logoGray3,
  HEX.logoGray4,
  HEX.logoGray5,
] as const;

export type WelcomeLogoColorOverride = {
  line: number;
  start: number;
  end: number;
  color: string;
};

export const WELCOME_LOGO_OVERRIDES: readonly WelcomeLogoColorOverride[] = [
  { line: 1, start: 4, end: 5, color: HEX.greenAccentAlt },
  { line: 2, start: 3, end: 6, color: HEX.logoGreenMid },
  { line: 3, start: 4, end: 5, color: HEX.logoGreenMid },
  { line: 4, start: 4, end: 5, color: HEX.logoGreenMid },
  { line: 5, start: 3, end: 5, color: HEX.logoGreenMid },
  { line: 6, start: 1, end: 4, color: HEX.logoGreenMid },
  { line: 1, start: 6, end: 6, color: HEX.logoGreenDark },
  { line: 3, start: 3, end: 3, color: HEX.logoGreenDark },
  { line: 6, start: 4, end: 7, color: HEX.logoGreenDark },
  { line: 7, start: 0, end: 7, color: HEX.logoGreenDark },
] as const;

export type BoardThemePalette = {
  id: BoardThemeId;
  name: string;
  lightCell: string;
  darkCell: string;
  highlightLight: string;
  highlightDark: string;
  premoveLight: string;
  premoveDark: string;
  validMoveDotDark: string;
  validMoveDotLight: string;
};

export type BoardThemeId = "default" | "sea" | "wood" | "glassy";

export const DEFAULT_BOARD_THEME_ID: BoardThemeId = "default";

export const BOARD_THEME_OPTIONS: Array<{ id: BoardThemeId; name: string }> = [
  { id: "default", name: "Classic" },
  { id: "sea", name: "Ocean Breeze" },
  { id: "wood", name: "Mahogany" },
  { id: "glassy", name: "Frosted Glass" },
];

export const BOARD_THEMES: Record<BoardThemeId, BoardThemePalette> = {
  default: {
    id: "default",
    name: "Classic",
    lightCell: HEX.boardDefaultLight,
    darkCell: HEX.boardDefaultDark,
    highlightLight: HEX.boardDefaultHighlightLight,
    highlightDark: HEX.boardDefaultHighlightDark,
    premoveLight: HEX.boardDefaultPremoveLight,
    premoveDark: HEX.boardDefaultPremoveDark,
    validMoveDotDark: HEX.boardDotDark,
    validMoveDotLight: HEX.boardDotLight,
  },
  sea: {
    id: "sea",
    name: "Ocean Breeze",
    lightCell: HEX.seaLight,
    darkCell: HEX.seaDark,
    highlightLight: HEX.seaHighlightLight,
    highlightDark: HEX.seaHighlightDark,
    premoveLight: HEX.seaPremoveLight,
    premoveDark: HEX.seaPremoveDark,
    validMoveDotDark: HEX.seaDotDark,
    validMoveDotLight: HEX.seaDotLight,
  },
  wood: {
    id: "wood",
    name: "Mahogany",
    lightCell: HEX.woodLight,
    darkCell: HEX.woodDark,
    highlightLight: HEX.woodHighlightLight,
    highlightDark: HEX.woodHighlightDark,
    premoveLight: HEX.woodPremoveLight,
    premoveDark: HEX.woodPremoveDark,
    validMoveDotDark: HEX.woodDotDark,
    validMoveDotLight: HEX.woodDotLight,
  },
  glassy: {
    id: "glassy",
    name: "Frosted Glass",
    lightCell: HEX.glassyLight,
    darkCell: HEX.glassyDark,
    highlightLight: HEX.glassyHighlightLight,
    highlightDark: HEX.glassyHighlightDark,
    premoveLight: HEX.glassyPremoveLight,
    premoveDark: HEX.glassyPremoveDark,
    validMoveDotDark: HEX.glassyDotDark,
    validMoveDotLight: HEX.glassyDotLight,
  },
};
