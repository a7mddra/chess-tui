import { render, Box, Text, useApp, useInput, useStdout } from "ink";
import React, { useState } from "react";
import { Board, InputBox, PlayerInfo } from "@/features";
import { useChessBoard } from "@/features/board/use-chess-board";
import { HighlightBox } from "@/components";
import { getMockGameSnapshot } from "@/lib";
import { DIALOG_HOWTO } from "@/lib/config/dialogs";

const ACCENT = "#b2e068";
const BORDER_COLOR = "#555555";
const BOARD_WIDTH = 50;

const DevScreen = (): React.JSX.Element => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  const boardWidth = Math.min(BOARD_WIDTH, columns - 25);
  const panelWidth = columns - boardWidth;

  const [dialogLines, setDialogLines] = useState<string[]>(DIALOG_HOWTO.lines);

  const snapshot = getMockGameSnapshot("chesscom");

  // In this dev test, we play both sides!
  // The chessBoard is entirely driven by our inputs and flushPremoves handles the queue
  // based on the sophisticated logic added earlier.
  const chessBoard = useChessBoard(snapshot.fen, (uci) => {
    // We could log the uci if needed
  }, { selfPlay: true });

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input.toLowerCase() === "c")) {
      exit();
    }
  });

  return (
    <Box width={columns} height={rows} flexDirection="row">
      <Box
        borderStyle="round"
        borderColor={BORDER_COLOR}
        width={panelWidth}
        height={rows}
        flexDirection="column"
        paddingTop={1}
      >
        <Box flexDirection="column" flexGrow={0}>
          <PlayerInfo
            {...snapshot.players.top}
            isActive={chessBoard.turn === "b"}
          />
          <Box height={1} />
          <PlayerInfo
            {...snapshot.players.bottom}
            isActive={chessBoard.turn === "w"}
          />
        </Box>
        <Box flexGrow={1} />
        <Box flexDirection="column" alignItems="center">
          <Box height={1} />
          <HighlightBox
            label={dialogLines}
            width={panelWidth - 4}
            height={6}
            align="left"
            topBorder
          />
          <InputBox
            width={panelWidth - 4}
            onDialogChange={setDialogLines}
            commands={snapshot.commands}
            onMove={chessBoard.handleUserInput}
            onCommand={chessBoard.executeCommand}
          />
        </Box>
      </Box>

      <Box
        borderStyle="round"
        borderColor={BORDER_COLOR}
        flexGrow={1}
        height={rows}
        flexDirection="column"
      >
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Box position="absolute" marginLeft={1} marginTop={0}>
            <Text color={ACCENT}>⌞ ⌝</Text>
          </Box>
          <Board
            board={chessBoard.board}
            lastRealMove={chessBoard.lastRealMove}
            premoveJumps={chessBoard.premoveJumps}
            selectedSquare={chessBoard.selectedSquare}
            validMoves={chessBoard.validMoves}
            isFlipped={false}
          />
        </Box>
        <Box paddingX={1}>
          <Text color={BORDER_COLOR}>dev environment</Text>
        </Box>
      </Box>
    </Box>
  );
};

render(<DevScreen />, { exitOnCtrlC: false });
