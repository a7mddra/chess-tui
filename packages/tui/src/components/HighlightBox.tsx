import React from "react";
import { Box, Text } from "ink";

const DIM_BG = "#2a2a2a";

type HighlightBoxProps = {
  label: string | string[];
  width: number;
  height: number;
  align?: "center" | "left";
  topBorder?: boolean;
  paddingX?: number;
  paddingY?: number;
  padding?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
};

/**
 * Word-wrap a list of lines so no line exceeds `maxWidth`.
 * Splits on word boundaries; if a single word is longer than
 * maxWidth it is kept as-is (hard truncation happens at render).
 */
const wrapLines = (lines: string[], maxWidth: number): string[] => {
  const result: string[] = [];

  for (const raw of lines) {
    if (raw.length <= maxWidth) {
      result.push(raw);
      continue;
    }

    const words = raw.split(" ");
    let current = "";

    for (const word of words) {
      if (current === "") {
        current = word;
      } else if (current.length + 1 + word.length <= maxWidth) {
        current += " " + word;
      } else {
        result.push(current);
        current = word;
      }
    }

    if (current) result.push(current);
  }

  return result;
};

export const HighlightBox = ({
  label,
  width,
  height,
  align = "center",
  topBorder = false,
  paddingX,
  paddingY,
  padding,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
}: HighlightBoxProps): React.JSX.Element => {
  const rawLines = Array.isArray(label) ? label : [label];

  // Left-align uses 1 char padding, so effective wrap width is narrower
  const contentWidth = align === "left" ? width - 1 : width;
  const lines = wrapLines(rawLines, contentWidth);

  // Always start from the top (row 0)
  const startIdx = 0;

  return (
    <Box
      flexDirection="column"
      width={width}
      paddingX={paddingX}
      paddingY={paddingY}
      padding={padding}
      paddingLeft={paddingLeft}
      paddingRight={paddingRight}
      paddingTop={paddingTop}
      paddingBottom={paddingBottom}
    >
      {topBorder && <Text color={DIM_BG}>{"▄".repeat(Math.max(0, width))}</Text>}
      {Array.from({ length: height }, (_, i) => {
        let line = " ".repeat(width);
        const text =
          i >= startIdx && i < startIdx + lines.length
            ? (lines[i - startIdx] || "")
            : "";

        if (text) {
          if (align === "center") {
            const pad = Math.max(0, Math.floor((width - text.length) / 2));
            line =
              " ".repeat(pad) +
              text +
              " ".repeat(Math.max(0, width - pad - text.length));
          } else if (align === "left") {
            line =
              " " + text + " ".repeat(Math.max(0, width - text.length - 1));
          }
        }

        const isSelected = text.startsWith(">");
        const lineColor = isSelected ? "#688ba6" : "#666666";

        return (
          <Text key={`hl-${i}`} backgroundColor={DIM_BG} color={lineColor}>
            {line.slice(0, width)}
          </Text>
        );
      })}
    </Box>
  );
};
