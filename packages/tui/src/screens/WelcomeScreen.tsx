import React, { Fragment, type ReactNode, useMemo, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useRouter } from "@/router/AppRouter";
import {
  openExternalUrl,
  github,
  UI_COLORS,
  WELCOME_LOGO_GRADIENT,
  WELCOME_LOGO_OVERRIDES,
} from "@/lib";

const CURSOR_GLYPH = "➣";
const MIN_INNER_FRAME_WIDTH = 67;

const LOGO_LINES = [
  "    ██╗                                                         ",
  "   ████ ██████╗██╗  ██╗███████╗███████╗███████╗                 ",
  "   ╚██ ██╔════╝██║  ██║██╔════╝██╔════╝██╔════╝                 ",
  "    ██ ██║     ███████║█████╗  ███████╗███████╗██████╗██╗ ██╗██╗",
  "   ███ ██║     ██╔══██║██╔══╝  ╚════██║╚════██║╚═██╔═╝██║ ██║██║",
  " ███████ █████╗██║  ██║███████╗███████║███████║  ██║  ██████║██║",
  " ╚══════ ╚════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝  ╚═╝  ╚═════╝╚═╝",
] as const;

const LOGO_GRADIENT = WELCOME_LOGO_GRADIENT;

const LOGO_COLOR_OVERRIDES = WELCOME_LOGO_OVERRIDES;

const getLogoBaseColor = (lineIndex: number): string =>
  LOGO_GRADIENT[Math.min(lineIndex, LOGO_GRADIENT.length - 1)] ??
  LOGO_GRADIENT[0];

const getLogoCharColor = (lineIndex: number, charIndex: number): string => {
  let color = getLogoBaseColor(lineIndex);

  for (const override of LOGO_COLOR_OVERRIDES) {
    if (
      override.line === lineIndex + 1 &&
      charIndex >= override.start &&
      charIndex <= override.end
    ) {
      color = override.color;
    }
  }

  return color;
};

const renderLogoLine = (line: string, lineIndex: number): ReactNode => {
  const chars = [...line];
  const segments: Array<{ text: string; color: string }> = [];

  chars.forEach((char, charIndex) => {
    const color = getLogoCharColor(lineIndex, charIndex);
    const previousSegment = segments[segments.length - 1];

    if (previousSegment && previousSegment.color === color) {
      previousSegment.text += char;
      return;
    }

    segments.push({ text: char, color });
  });

  return segments.map((segment, segmentIndex) => (
    <Text color={segment.color} key={`logo-${lineIndex}-${segmentIndex}`}>
      {segment.text}
    </Text>
  ));
};

const ACCENT_COLOR = UI_COLORS.accent;

const MENU_ITEMS = [
  { id: "chesscom", label: "♟𝗰𝗵𝗲𝘀𝘀.com" },
  { id: "stockfish", label: "Stockfish 18" },
  { id: "github", label: "GitHub" },
  { id: "exit", label: "Exit" },
] as const;

const textWidth = (value: string): number => [...value].length;
const spaces = (count: number): string => " ".repeat(Math.max(0, count));

const padCentered = (
  contentWidth: number,
  totalWidth: number,
): { left: number; right: number } => {
  const safeContentWidth = Math.min(contentWidth, totalWidth);
  const left = Math.max(0, Math.floor((totalWidth - safeContentWidth) / 2));
  const right = Math.max(0, totalWidth - safeContentWidth - left);

  return { left, right };
};

type FrameLineProps = {
  contentWidth: number;
  innerWidth: number;
  children?: ReactNode;
};

const FrameLine = ({
  contentWidth,
  innerWidth,
  children,
}: FrameLineProps): React.JSX.Element => {
  const { left, right } = padCentered(contentWidth, innerWidth);

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

const renderMenuLabel = (itemId: string, label: string): ReactNode => {
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
  const { exit } = useApp();
  const { navigate } = useRouter();
  const { stdout } = useStdout();
  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const longestLogoLine = useMemo(
    () => LOGO_LINES.reduce((max, line) => Math.max(max, textWidth(line)), 0),
    [],
  );

  const longestMenuLine = useMemo(
    () =>
      MENU_ITEMS.reduce((max, item) => {
        const line = `${CURSOR_GLYPH} ${item.label}`;
        return Math.max(max, textWidth(line));
      }, 0),
    [],
  );
  const longestMenuLabel = useMemo(
    () =>
      MENU_ITEMS.reduce((max, item) => Math.max(max, textWidth(item.label)), 0),
    [],
  );

  const desiredInnerWidth = Math.max(
    MIN_INNER_FRAME_WIDTH,
    longestLogoLine + 2,
    longestMenuLine + 2,
  );

  const maxInnerWidth = Math.max(20, columns - 2);
  const innerWidth = Math.min(desiredInnerWidth, maxInnerWidth);
  const cursorColumn = Math.max(
    0,
    Math.floor((innerWidth - longestMenuLabel) / 2) - 2,
  );

  useInput((input, key) => {
    if (key.ctrl && input.toLowerCase() === "c") {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(
        (previous) => (previous - 1 + MENU_ITEMS.length) % MENU_ITEMS.length,
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((previous) => (previous + 1) % MENU_ITEMS.length);
      return;
    }

    if (!key.return) {
      return;
    }

    const selectedItem = MENU_ITEMS[selectedIndex];
    if (!selectedItem) {
      return;
    }

    if (selectedItem.id === "chesscom") {
      navigate("chesscom");
    } else if (selectedItem.id === "stockfish") {
      navigate("stockfish");
    } else if (selectedItem.id === "github") {
      void openExternalUrl(github.repo);
    } else if (selectedItem.id === "exit") {
      exit();
    }
  });

  return (
    <Box
      width={columns}
      height={rows}
      alignItems="center"
      justifyContent="center"
    >
      <Box flexDirection="column">
        <Text>{"╭" + "─".repeat(innerWidth) + "╮"}</Text>
        <FrameLine contentWidth={0} innerWidth={innerWidth} />

        {LOGO_LINES.map((line, index) => (
          <FrameLine
            contentWidth={textWidth(line)}
            innerWidth={innerWidth}
            key={`logo-${index}`}
          >
            {renderLogoLine(line, index)}
          </FrameLine>
        ))}

        <FrameLine contentWidth={0} innerWidth={innerWidth} />
        <FrameLine contentWidth={0} innerWidth={innerWidth} />

        {MENU_ITEMS.map((item, index) => {
          const isSelected = selectedIndex === index;
          const labelWidth = textWidth(item.label);
          const centeredLabelStart = Math.max(
            0,
            Math.floor((innerWidth - labelWidth) / 2),
          );
          const gapBeforeLabel = Math.max(
            1,
            centeredLabelStart - (cursorColumn + 1),
          );
          const rightPadding = Math.max(
            0,
            innerWidth - (cursorColumn + 1 + gapBeforeLabel + labelWidth),
          );
          const isFirstOption = item.id === "chesscom";
          const menuLabel = isFirstOption ? (
            renderMenuLabel(item.id, item.label)
          ) : isSelected ? (
            <Text color={ACCENT_COLOR}>{item.label}</Text>
          ) : (
            item.label
          );

          return (
            <FrameLine
              contentWidth={innerWidth}
              innerWidth={innerWidth}
              key={item.id}
            >
              {spaces(cursorColumn)}
              {isSelected ? (
                <Text color={ACCENT_COLOR}>{CURSOR_GLYPH}</Text>
              ) : (
                " "
              )}
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
