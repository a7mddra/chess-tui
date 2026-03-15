import React from "react";
import { Box, Text } from "ink";

const DIM_BG = "#2a2a2a";

type HighlightBoxProps = {
  label: string | string[];
  width: number;
  height: number;
  align?: "center" | "left";
  paddingX?: number;
  paddingY?: number;
  padding?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
};

export const HighlightBox = ({
  label,
  width,
  height,
  align = "center",
  paddingX,
  paddingY,
  padding,
  paddingLeft,
  paddingRight,
  paddingTop,
  paddingBottom,
}: HighlightBoxProps): React.JSX.Element => {
  const lines = Array.isArray(label) ? label : [label];
  const startIdx = Math.max(0, Math.floor((height - lines.length) / 2));

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
            // Add 1 space of padding for visual balance when left aligned
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
