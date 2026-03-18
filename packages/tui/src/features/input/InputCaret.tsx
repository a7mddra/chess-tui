import React from "react";
import { Box, Text } from "ink";
import { UI_COLORS } from "@/lib";

const DIM_BG = UI_COLORS.dimBackground;

type InputCaretProps = {
  value: string;
  cursor: number;
  width: number;
};

export const InputCaret = ({
  value,
  cursor,
  width,
}: InputCaretProps): React.JSX.Element => {
  const isEmpty = value === "";
  const placeholder = "e2e4, / for cmds";
  const safeWidth = Math.max(0, width - 1);

  const displayText = isEmpty ? "" : value;
  const clampedCursor = Math.min(cursor, displayText.length);

  const before = displayText.slice(0, clampedCursor);
  const hasCursorChar = clampedCursor < displayText.length;
  const cursorChar = hasCursorChar ? (displayText[clampedCursor] ?? " ") : " ";
  const after = hasCursorChar
    ? displayText.slice(clampedCursor + 1)
    : displayText.slice(clampedCursor);

  const visibleBefore = before.slice(0, safeWidth);
  const remainingAfterBefore = Math.max(0, safeWidth - visibleBefore.length);
  const visibleCursor = remainingAfterBefore > 0 ? cursorChar : "";
  const remainingAfterCursor = Math.max(
    0,
    remainingAfterBefore - visibleCursor.length,
  );
  const visibleAfter = after.slice(0, remainingAfterCursor);
  const used =
    visibleBefore.length + visibleCursor.length + visibleAfter.length;

  const placeholderGap = isEmpty ? " " : "";
  const placeholderSlice = isEmpty
    ? placeholder.slice(
        0,
        Math.max(0, safeWidth - used - placeholderGap.length),
      )
    : "";
  const totalUsed = used + placeholderGap.length + placeholderSlice.length;
  const pad = Math.max(0, safeWidth - totalUsed);

  return (
    <Box position="absolute" marginTop={1} width={width}>
      <Text backgroundColor={DIM_BG}> </Text>
      <Text backgroundColor={DIM_BG} color={isEmpty ? UI_COLORS.border : UI_COLORS.muted}>
        {visibleBefore}
      </Text>
      <Text backgroundColor="white" color="black">
        {visibleCursor}
      </Text>
      {isEmpty ? (
        <Text backgroundColor={DIM_BG} color={UI_COLORS.border}>
          {placeholderGap}
          {placeholderSlice}
          {" ".repeat(pad)}
        </Text>
      ) : (
        <Text backgroundColor={DIM_BG} color={UI_COLORS.muted}>
          {visibleAfter}
          {" ".repeat(pad)}
        </Text>
      )}
    </Box>
  );
};
