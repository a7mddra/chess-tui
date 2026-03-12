import React, {Fragment, type ReactNode, useEffect, useMemo, useState} from "react";
import {Box, Text, useApp, useInput, useStdout} from "ink";
import {openExternalUrl} from "../../platform/open-url.js";

const GITHUB_REPO_URL = "https://github.com/a7mddra/chess-tui.git";
const CURSOR_GLYPH = "➣";
const MIN_INNER_FRAME_WIDTH = 67;

const LOGO_LINES = [
  " ██████╗██╗  ██╗███████╗███████╗███████╗                 ",
  "██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝                 ",
  "██║     ███████║█████╗  ███████╗███████╗██████╗██╗ ██╗██╗",
  "██║     ██╔══██║██╔══╝  ╚════██║╚════██║╚═██╔═╝██║ ██║██║",
  "╚██████╗██║  ██║███████╗███████║███████║  ██║  ██████║██║",
  " ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝  ╚═╝  ╚═════╝╚═╝"
] as const;

const LOGO_GRADIENT = [
  "#ffffff",
  "#f5f5f5",
  "#ebebeb",
  "#e1e1e1",
  "#d7d7d7",
  "#cdcdcd"
] as const;
const ACCENT_GRADIENT = ["#5d9948", "#6ca54a", "#b2e068"] as const;
const ACCENT_ANIMATION_MS = 1400;
const ACCENT_COLOR = "#b2e068";

const MENU_ITEMS = [
  {id: "chesscom", label: "♟𝗰𝗵𝗲𝘀𝘀.com"},
  {id: "stockfish", label: "Stockfish 18"},
  {id: "github", label: "GitHub"},
  {id: "exit", label: "Exit"}
] as const;

const textWidth = (value: string): number => [...value].length;
const spaces = (count: number): string => " ".repeat(Math.max(0, count));

const padCentered = (contentWidth: number, totalWidth: number): {left: number; right: number} => {
  const safeContentWidth = Math.min(contentWidth, totalWidth);
  const left = Math.max(0, Math.floor((totalWidth - safeContentWidth) / 2));
  const right = Math.max(0, totalWidth - safeContentWidth - left);

  return {left, right};
};

const hexToRgb = (hex: string): {r: number; g: number; b: number} => {
  const normalized = hex.replace("#", "");

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
};

const rgbToHex = ({r, g, b}: {r: number; g: number; b: number}): string => {
  const toHex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const interpolateHex = (fromHex: string, toHex: string, progress: number): string => {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);

  const mix = (start: number, end: number): number =>
    Math.round(start + (end - start) * progress);

  return rgbToHex({
    r: mix(from.r, to.r),
    g: mix(from.g, to.g),
    b: mix(from.b, to.b)
  });
};

const gradientColorAt = (stops: readonly string[], progress: number): string => {
  if (progress <= 0) {
    return stops[0] ?? "#ffffff";
  }

  if (progress >= 1) {
    return stops[stops.length - 1] ?? "#ffffff";
  }

  const segments = stops.length - 1;
  const scaled = progress * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const localProgress = scaled - index;
  const from = stops[index] ?? stops[0] ?? "#ffffff";
  const to = stops[index + 1] ?? stops[stops.length - 1] ?? "#ffffff";

  return interpolateHex(from, to, localProgress);
};

type FrameLineProps = {
  contentWidth: number;
  innerWidth: number;
  children?: ReactNode;
};

const FrameLine = ({contentWidth, innerWidth, children}: FrameLineProps): React.JSX.Element => {
  const {left, right} = padCentered(contentWidth, innerWidth);

  return (
    <Text>
      {"│"}
      {spaces(left)}
      {children}
      {spaces(right)}
      {"│"}
    </Text>
  );
};

const renderMenuLabel = (itemId: string, label: string, accentColor: string): ReactNode => {
  if (itemId !== "chesscom") {
    return label;
  }

  return (
    <Fragment>
      <Text color={ACCENT_COLOR}>♟</Text>
      <Text>𝗰𝗵𝗲𝘀𝘀.com</Text>
    </Fragment>
  );
};

export const WelcomeScreen = (): React.JSX.Element => {
  const {exit} = useApp();
  const {stdout} = useStdout();
  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [accentPhase, setAccentPhase] = useState(0);

  useEffect(() => {
    let startMs = Date.now();

    const timer = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const loop = (elapsed % ACCENT_ANIMATION_MS) / ACCENT_ANIMATION_MS;
      const pingPong = loop < 0.5 ? loop * 2 : (1 - loop) * 2;
      setAccentPhase(pingPong);
    }, 75);

    return () => {
      clearInterval(timer);
      startMs = 0;
    };
  }, []);

  const longestLogoLine = useMemo(
    () => LOGO_LINES.reduce((max, line) => Math.max(max, textWidth(line)), 0),
    []
  );

  const longestMenuLine = useMemo(
    () =>
      MENU_ITEMS.reduce((max, item) => {
        const line = `${CURSOR_GLYPH} ${item.label}`;
        return Math.max(max, textWidth(line));
      }, 0),
    []
  );
  const longestMenuLabel = useMemo(
    () => MENU_ITEMS.reduce((max, item) => Math.max(max, textWidth(item.label)), 0),
    []
  );

  const desiredInnerWidth = Math.max(
    MIN_INNER_FRAME_WIDTH,
    longestLogoLine + 2,
    longestMenuLine + 2
  );

  const maxInnerWidth = Math.max(20, columns - 2);
  const innerWidth = Math.min(desiredInnerWidth, maxInnerWidth);
  const accentColor = gradientColorAt(ACCENT_GRADIENT, accentPhase);
  const cursorColumn = Math.max(0, Math.floor((innerWidth - longestMenuLabel) / 2) - 2);

  useInput((input, key) => {
    if (key.ctrl && input.toLowerCase() === "c") {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(previous => (previous - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(previous => (previous + 1) % MENU_ITEMS.length);
      return;
    }

    if (!key.return) {
      return;
    }

    const selectedItem = MENU_ITEMS[selectedIndex];
    if (!selectedItem) {
      return;
    }

    if (selectedItem.id === "github") {
      void openExternalUrl(GITHUB_REPO_URL);
    }
      else if (selectedItem.id === "exit") {
        exit();
      }
  });

  return (
    <Box width={columns} height={rows} alignItems="center" justifyContent="center">
      <Box flexDirection="column">
        <Text>{"╭" + "─".repeat(innerWidth) + "╮"}</Text>
        <FrameLine contentWidth={0} innerWidth={innerWidth} />

        {LOGO_LINES.map((line, index) => (
          <FrameLine contentWidth={textWidth(line)} innerWidth={innerWidth} key={`logo-${index}`}>
            <Text color={LOGO_GRADIENT[index]}>{line}</Text>
          </FrameLine>
        ))}

        <FrameLine contentWidth={0} innerWidth={innerWidth} />
        <FrameLine contentWidth={0} innerWidth={innerWidth} />

        {MENU_ITEMS.map((item, index) => {
          const isSelected = selectedIndex === index;
          const labelWidth = textWidth(item.label);
          const centeredLabelStart = Math.max(0, Math.floor((innerWidth - labelWidth) / 2));
          const gapBeforeLabel = Math.max(1, centeredLabelStart - (cursorColumn + 1));
          const rightPadding = Math.max(
            0,
            innerWidth - (cursorColumn + 1 + gapBeforeLabel + labelWidth)
          );
          const isFirstOption = item.id === "chesscom";
          const menuLabel = isFirstOption
            ? renderMenuLabel(item.id, item.label, accentColor)
            : isSelected
              ? <Text color={ACCENT_COLOR}>{item.label}</Text>
              : item.label;

          return (
            <FrameLine contentWidth={innerWidth} innerWidth={innerWidth} key={item.id}>
              {spaces(cursorColumn)}
              {isSelected ? <Text color={accentColor}>{CURSOR_GLYPH}</Text> : " "}
              {spaces(gapBeforeLabel)}
              {menuLabel}
              {spaces(rightPadding)}
            </FrameLine>
          );
        })}

        <FrameLine contentWidth={0} innerWidth={innerWidth} />
        <Text>{"╰" + "─".repeat(innerWidth) + "╯"}</Text>
      </Box>
    </Box>
  );
};
