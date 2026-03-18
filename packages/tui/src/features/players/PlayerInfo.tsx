import React from "react";
import { Box, Text } from "ink";

const CAPTURED_SORT_ORDER: Record<string, number> = {
  "♙": 0,
  "♟": 0,
  "♘": 1,
  "♞": 1,
  "♗": 2,
  "♝": 2,
  "♖": 3,
  "♜": 3,
  "♕": 4,
  "♛": 4,
  "♔": 5,
  "♚": 5,
};

function sortCapturedByPiecePower(captured: string): string {
  const symbols = Array.from(captured).filter((ch) => CAPTURED_SORT_ORDER[ch] !== undefined);
  const unknown = Array.from(captured).filter((ch) => CAPTURED_SORT_ORDER[ch] === undefined);

  symbols.sort((a, b) => {
    return CAPTURED_SORT_ORDER[a]! - CAPTURED_SORT_ORDER[b]!;
  });

  return [...symbols, ...unknown].join("");
}

export type PlayerInfoProps = {
  name: string;
  elo: number | null;
  clock: string;
  captured: string;
  advantage: string;
  width?: number;
  isActive?: boolean;
};

export const PlayerInfo = ({
  name,
  elo,
  clock,
  captured,
  advantage,
  width = 28,
  isActive = true,
}: PlayerInfoProps): React.JSX.Element => {
  const clockBadge = ` ◴ ${clock} `;
  const nameLabel = `${name} (${elo ?? "-"})`;
  const leftWidth = Math.max(0, width - clockBadge.length);
  const sortedCaptured = sortCapturedByPiecePower(captured);

  const clampedName = nameLabel.length > leftWidth
    ? `${nameLabel.slice(0, Math.max(0, leftWidth - 1))}…`
    : nameLabel;

  const firstLine = `${clampedName}${" ".repeat(Math.max(0, leftWidth - clampedName.length))}${clockBadge}`;

  const capturedLabel = `${sortedCaptured}${advantage ? ` ${advantage}` : ""}`;
  const secondLine = capturedLabel.length > width
    ? `${capturedLabel.slice(0, Math.max(0, width - 1))}…`
    : capturedLabel;
  const secondLinePadded = `${secondLine}${" ".repeat(Math.max(0, width - secondLine.length))}`;

  return (
    <Box flexDirection="column" paddingX={1} width={width + 2}>
      <Text bold dimColor={!isActive} wrap="truncate-end">
        <Text>{firstLine.slice(0, width)}</Text>
      </Text>
      <Text color="#aaaaaa" dimColor={!isActive} wrap="truncate-end">
        {secondLinePadded.slice(0, width)}
      </Text>
    </Box>
  );
};