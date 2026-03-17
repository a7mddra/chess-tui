import React from "react";
import { Box, Text } from "ink";

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

  const clampedName = nameLabel.length > leftWidth
    ? `${nameLabel.slice(0, Math.max(0, leftWidth - 1))}…`
    : nameLabel;

  const firstLine = `${clampedName}${" ".repeat(Math.max(0, leftWidth - clampedName.length))}${clockBadge}`;

  const capturedLabel = `${captured}${advantage ? ` ${advantage}` : ""}`;
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