import React from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { useRouter, type GameMode } from "@/router/AppRouter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#b2e068";
const DIM_BG = "#2a2a2a";
const BORDER_COLOR = "#555555";

const BOARD_WIDTH = 43;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PLAYERS = {
  top: {
    name: "Magnus",
    elo: 2830,
    clock: "22:10",
    captured: "♝♞♟♟",
    advantage: "",
  },
  bottom: {
    name: "Hikaru",
    elo: 2785,
    clock: "25:10",
    captured: "♗♘♖",
    advantage: "+3",
  },
} as const;

// ---------------------------------------------------------------------------
// Player info
// ---------------------------------------------------------------------------

type PlayerInfoProps = {
  name: string;
  elo: number;
  clock: string;
  captured: string;
  advantage: string;
};

const PlayerInfo = ({
  name,
  elo,
  clock,
  captured,
  advantage,
}: PlayerInfoProps): React.JSX.Element => (
  <Box flexDirection="column" paddingX={1}>
    <Box justifyContent="space-between">
      <Text bold>
        {name} ({elo})
      </Text>
      <Text backgroundColor={DIM_BG} color={ACCENT}>
        {" "}
        ◴ {clock}{" "}
      </Text>
    </Box>
    <Text color="#aaaaaa">
      {captured}
      {advantage ? ` ${advantage}` : ""}
    </Text>
  </Box>
);

// ---------------------------------------------------------------------------
// Highlighted footer box
// ---------------------------------------------------------------------------

type HighlightBoxProps = {
  label: string;
  width: number;
  height: number;
};

const HighlightBox = ({
  label,
  width,
  height,
}: HighlightBoxProps): React.JSX.Element => (
  <Box flexDirection="column" width={width}>
    {Array.from({ length: height }, (_, i) => {
      const isCenter = i === Math.floor(height / 2);
      const pad = Math.max(0, Math.floor((width - label.length) / 2));
      const line = isCenter
        ? " ".repeat(pad) +
          label +
          " ".repeat(Math.max(0, width - pad - label.length))
        : " ".repeat(width);

      return (
        <Text key={`hl-${i}`} backgroundColor={DIM_BG} color="#666666">
          {line}
        </Text>
      );
    })}
  </Box>
);

// ---------------------------------------------------------------------------
// GameScreen
// ---------------------------------------------------------------------------

type GameScreenProps = {
  mode: GameMode;
};

export const GameScreen = ({
  mode: _mode,
}: GameScreenProps): React.JSX.Element => {
  const { navigate } = useRouter();
  const { exit } = useApp();
  const { stdout } = useStdout();

  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  const footerHeight = 3;
  const mainHeight = Math.max(10, rows - footerHeight);
  const boardWidth = Math.min(BOARD_WIDTH, columns - 22);
  const panelWidth = Math.max(20, columns - boardWidth - 2);

  useInput((input, key) => {
    if (key.escape) {
      navigate("welcome");
      return;
    }

    if (key.ctrl && input.toLowerCase() === "c") {
      exit();
    }
  });

  return (
    <Box width={columns} height={rows} flexDirection="column">
      {/* ── Main: board + panel ─────────────────────────────────────── */}
      <Box flexDirection="row" height={mainHeight}>
        {/* ── Board placeholder ──────────────────────────── */}
        <Box
          borderStyle="round"
          borderColor={BORDER_COLOR}
          width={boardWidth}
          justifyContent="center"
          alignItems="center"
        >
          <Text color="#666666">Board</Text>
        </Box>

        {/* ── Info panel ──────────────────────────── */}
        <Box
          borderStyle="round"
          borderColor={BORDER_COLOR}
          flexGrow={1}
          flexDirection="column"
          justifyContent="space-between"
          paddingY={1}
        >
          <PlayerInfo {...MOCK_PLAYERS.top} />
          <PlayerInfo {...MOCK_PLAYERS.bottom} />
        </Box>
      </Box>

      {/* ── Footer ───────────────────── */}
      <Box
        flexDirection="row"
        paddingX={1}
        paddingBottom={1}
        height={footerHeight + 1}
      >
        <HighlightBox
          label="Input"
          width={panelWidth}
          height={footerHeight + 1}
        />
        <Box width={1} />
        <HighlightBox
          label="Commands"
          width={boardWidth - 1}
          height={footerHeight + 1}
        />
      </Box>
    </Box>
  );
};
