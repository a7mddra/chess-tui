import React, { useState, useRef, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { ChildProcess } from "node:child_process";
import { useRouter, type GameMode } from "@/router/AppRouter";
import { Board } from "@/features/board/Board";
import { spawnBoardWindow } from "@/lib/helpers/spawn-terminal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#b2e068";
const DIM_BG = "#2a2a2a";
const BORDER_COLOR = "#555555";

const BOARD_WIDTH = 36;

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

  const [detached, setDetached] = useState(false);
  const childRef = useRef<ChildProcess | null>(null);

  const toggleDetach = useCallback(() => {
    if (detached) {
      // Reattach — kill the detached window
      if (childRef.current) {
        childRef.current.kill();
        childRef.current = null;
      }
      setDetached(false);
    } else {
      // Detach — spawn board in new terminal
      const child = spawnBoardWindow();
      if (child) {
        childRef.current = child;
        setDetached(true);
      }
    }
  }, [detached]);

  useInput((input, key) => {
    if (key.escape) {
      // Kill detached window on exit
      if (childRef.current) {
        childRef.current.kill();
        childRef.current = null;
      }
      navigate("welcome");
      return;
    }

    if (key.ctrl && input.toLowerCase() === "d") {
      toggleDetach();
      return;
    }

    if (key.ctrl && input.toLowerCase() === "c") {
      if (childRef.current) {
        childRef.current.kill();
        childRef.current = null;
      }
      exit();
    }
  });

  return (
    <Box width={columns} height={rows} flexDirection="column">
      {/* ── Main: board + panel ─────────────────────────────────────── */}
      <Box flexDirection="row" height={mainHeight}>
        {/* ── Board area ──────────────────────────── */}
        <Box
          borderStyle="round"
          borderColor={BORDER_COLOR}
          width={boardWidth}
          justifyContent="center"
          alignItems="center"
          flexDirection="column"
        >
          {detached ? (
            <>
              <Text color="#666666">board detached</Text>
              <Text color={ACCENT}> ↺ Ctrl+D to restore </Text>
            </>
          ) : (
            <>
              <Box position="absolute" marginLeft={1} marginTop={0}>
                <Text color={ACCENT}>⌞ ⌝</Text>
              </Box>
              <Board />
            </>
          )}
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
