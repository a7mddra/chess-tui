import React, { useState, useRef, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import type { ChildProcess } from "node:child_process";
import { useRouter, type GameMode } from "@/router/AppRouter";
import { Board, InputBox, PlayerInfo } from "@/features";
import { useChessBoard } from "@/features/board/use-chess-board";
import { HighlightBox } from "@/components";
import { spawnBoardWindow, useBoardIpcServer, DIALOG_HOWTO, getMockGameSnapshot, mod } from "@/lib";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#b2e068";
const DIM_BG = "#2a2a2a";
const BORDER_COLOR = "#555555";

const BOARD_WIDTH = 50;

// ---------------------------------------------------------------------------
// DVD-bounce animation (for detached state)
// ---------------------------------------------------------------------------

const DVD_LABEL = "board detached";

const DvdBounce = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): React.JSX.Element => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const vel = useRef({ dx: 1, dy: 1 });

  const labelLen = DVD_LABEL.length;
  const maxX = Math.max(0, width - labelLen);
  const maxY = Math.max(0, height - 1);

  useEffect(() => {
    const id = setInterval(() => {
      setPos((prev) => {
        let nx = prev.x + vel.current.dx;
        let ny = prev.y + vel.current.dy;
        if (nx <= 0 || nx >= maxX) vel.current.dx *= -1;
        if (ny <= 0 || ny >= maxY) vel.current.dy *= -1;
        nx = Math.max(0, Math.min(maxX, nx));
        ny = Math.max(0, Math.min(maxY, ny));
        return { x: nx, y: ny };
      });
    }, 350);
    return () => clearInterval(id);
  }, [maxX, maxY]);

  return (
    <Box width={width} height={height} flexDirection="column">
      {Array.from({ length: height }, (_, row) => (
        <Box key={row} width={width}>
          {row === pos.y ? (
            <Text>
              {" ".repeat(pos.x)}
              <Text color="#666666">{DVD_LABEL}</Text>
            </Text>
          ) : (
            <Text> </Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// GameScreen
// ---------------------------------------------------------------------------

type GameScreenProps = {
  mode: GameMode;
};

export const GameScreen = ({
  mode,
}: GameScreenProps): React.JSX.Element => {
  const { navigate } = useRouter();
  const { exit } = useApp();
  const { stdout } = useStdout();

  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  const boardWidth = Math.min(BOARD_WIDTH, columns - 25);
  const panelWidth = columns - boardWidth;

  const [detached, setDetached] = useState(false);
  const [dialogLines, setDialogLines] = useState<string[]>(DIALOG_HOWTO.lines);
  const childRef = useRef<ChildProcess | null>(null);

  const sessionId = React.useMemo(() => Math.random().toString(36).slice(2, 9), []);
  const snapshot = getMockGameSnapshot(mode);

  const chessBoard = useChessBoard(
    snapshot.fen,
    (uci) => {
      // Dispatch to real API here in the future
    },
    {
      onUndoFenDispatch: mode === "stockfish"
        ? (fen) => {
            // Stockfish offline path is stateless-per-request.
            // Send this historical FEN to the engine adapter when wired.
          }
        : undefined,
    },
  );

  useBoardIpcServer(sessionId, {
    board: chessBoard.board,
    lastRealMove: chessBoard.lastRealMove,
    premoveJumps: chessBoard.premoveJumps,
    selectedSquare: chessBoard.selectedSquare,
    validMoves: chessBoard.validMoves,
    isFlipped: mode === "stockfish" ? false : false,
  });

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
      const child = spawnBoardWindow(sessionId);
      if (child) {
        childRef.current = child;
        setDetached(true);
      }
    }
  }, [detached, sessionId]);

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
    <Box width={columns} height={rows} flexDirection="row">
      {/* ── Left panel ──────────────────────────── */}
      <Box
        borderStyle="round"
        borderColor={BORDER_COLOR}
        width={panelWidth}
        height={rows}
        flexDirection="column"
        paddingTop={1}
      >
        <Box flexDirection="column" flexGrow={0}>
          <PlayerInfo {...snapshot.players.top} isActive={false} />
          <Box height={1} />
          <PlayerInfo {...snapshot.players.bottom} isActive={true} />
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

      {/* ── Board area ──────────────────────────── */}
      <Box
        borderStyle="round"
        borderColor={BORDER_COLOR}
        flexGrow={1}
        height={rows}
        flexDirection="column"
      >
        {/* content area */}
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          {detached ? (
            <DvdBounce width={boardWidth - 2} height={rows - 4} />
          ) : (
            <>
              <Box position="absolute" marginLeft={1} marginTop={0}>
                <Text color={ACCENT}>⌞ ⌝</Text>
              </Box>
              <Board
                board={chessBoard.board}
                lastRealMove={chessBoard.lastRealMove}
                premoveJumps={chessBoard.premoveJumps}
                selectedSquare={chessBoard.selectedSquare}
                validMoves={chessBoard.validMoves}
                isFlipped={mode === "stockfish" ? false : false}
              />
            </>
          )}
        </Box>
        {/* footer hint */}
        <Box paddingX={1}>
          <Text color={BORDER_COLOR}>
            {detached ? `${mod("d")}: restore board` : `${mod("d")}: detach board`}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
