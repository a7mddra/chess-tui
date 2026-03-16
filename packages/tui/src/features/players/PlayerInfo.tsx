import React from "react";
import { Box, Text } from "ink";

export type PlayerInfoProps = {
  name: string;
  elo: number | null;
  clock: string;
  captured: string;
  advantage: string;
  isActive?: boolean;
};

const ACCENT = "#b2e068";
const DIM_BG = "#2a2a2a";

export const PlayerInfo = ({
  name,
  elo,
  clock,
  captured,
  advantage,
  isActive = true,
}: PlayerInfoProps): React.JSX.Element => (
  <Box flexDirection="column" paddingX={1}>
    <Box justifyContent="space-between">
      <Text bold dimColor={!isActive}>
        {name} ({elo ?? "-"})
      </Text>
      <Text backgroundColor={DIM_BG} color={ACCENT} dimColor={!isActive}>
        {" "}
        ◴ {clock}{" "}
      </Text>
    </Box>
    <Text color="#aaaaaa" dimColor={!isActive}>
      {captured}
      {advantage ? ` ${advantage}` : ""}
    </Text>
  </Box>
);