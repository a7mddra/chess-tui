import { render, Box, Text, useApp, useInput, useStdout } from "ink";
import React, { useState } from "react";
import { AppRouter } from "@/router/AppRouter";
import { Board, useBoardIpcClient } from "@/features";

// ---------------------------------------------------------------------------
// Standalone board window
// ---------------------------------------------------------------------------

const BoardScreen = ({ sessionId }: { sessionId: string }): React.JSX.Element => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const boardProps = useBoardIpcClient(sessionId);

  const columns = stdout.columns ?? 40;
  const rows = stdout.rows ?? 20;

  const [, refresh] = useState(0);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input.toLowerCase() === "c")) {
      exit();
      return;
    }

    if (key.ctrl && input.toLowerCase() === "r") {
      refresh((n) => n + 1);
    }
  });

  return (
    <Box
      width={columns}
      height={rows}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
    >
      {boardProps ? (
        <Board {...boardProps} />
      ) : (
        <Text>Waiting for main process...</Text>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

const detachedArg = process.argv.find(arg => arg.startsWith("--session-id="));
if (process.argv.includes("--detached-board") && detachedArg) {
  const sessionId = detachedArg.split("=")[1];
  if (sessionId) {
    render(<BoardScreen sessionId={sessionId} />, { exitOnCtrlC: false });
  }
} else {
  render(<AppRouter />, { exitOnCtrlC: false });
}
