// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { render } from "ink";
import React, { useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { Board } from "@/features";
import { useChessBoard } from "@/features/board/use-chess-board";

const BoardWindow = (): React.JSX.Element => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const chessBoard = useChessBoard();

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
      <Board
        board={chessBoard.board}
        lastRealMove={chessBoard.lastRealMove}
        premoveJumps={chessBoard.premoveJumps}
        selectedSquare={chessBoard.selectedSquare}
        validMoves={chessBoard.validMoves}
      />
    </Box>
  );
};

render(<BoardWindow />, { exitOnCtrlC: false });
