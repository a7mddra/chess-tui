import React, { useState, useRef, useCallback, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { ChildProcess } from "node:child_process";
import process from "node:process";
import { useRouter, type GameMode } from "@/router/AppRouter";
import { Board, InputBox, PlayerInfo } from "@/features";
import { useChessBoard } from "@/features/board/use-chess-board";
import { HighlightBox } from "@/components";
import {
  spawnBoardWindow,
  useBoardIpcServer,
  DIALOG_HOWTO,
  DIALOG_BROWSER_START,
  getMockGameSnapshot,
  useChesscomOnlineGame,
  mod,
} from "@/lib";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "#b2e068";
const BORDER_COLOR = "#555555";
const SPINNER_COLOR = "#688ba6";

const BOARD_WIDTH = 50;
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
const CHESS_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;
const EXIT_CONFIRM_TIMEOUT_MS = 2000;

const CHESSCOM_TEMP_PLAYERS = {
  top: {
    name: "opponent",
    elo: null,
    clock: "--:--",
    captured: "",
    advantage: "",
  },
  bottom: {
    name: "you",
    elo: null,
    clock: "--:--",
    captured: "",
    advantage: "",
  },
};

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
  const { stdout } = useStdout();

  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  const boardWidth = Math.min(BOARD_WIDTH, columns - 25);
  const panelWidth = columns - boardWidth;
  const playerInfoWidth = Math.max(18, panelWidth - 4);

  const [detached, setDetached] = useState(false);
  const [dialogLines, setDialogLines] = useState<string[]>(DIALOG_HOWTO.lines);
  const [spinnerFrameIndex, setSpinnerFrameIndex] = useState(0);
  const [lockBridgeDialog, setLockBridgeDialog] = useState(false);
  const [exitConfirmArmed, setExitConfirmArmed] = useState(false);
  const exitConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const childRef = useRef<ChildProcess | null>(null);

  const sessionId = React.useMemo(() => Math.random().toString(36).slice(2, 9), []);
  const mockSnapshot = getMockGameSnapshot(mode);
  const online = useChesscomOnlineGame(mode === "chesscom");

  const currentFen = mode === "chesscom" ? (online.fen ?? CHESS_START_FEN) : mockSnapshot.fen;

  const chessBoard = useChessBoard(
    currentFen,
    (move) => {
      if (mode !== "chesscom") {
        return;
      }

      const normalized = move.trim().toLowerCase();
      if (!UCI_MOVE_REGEX.test(normalized)) {
        return;
      }

      void online.sendMove(normalized);
    },
    {
      playerColor: mode === "chesscom" ? (online.boardOrientation ?? undefined) : undefined,
      onUndoFenDispatch: mode === "stockfish"
        ? (fen) => {
            // Stockfish offline path is stateless-per-request.
            // Send this historical FEN to the engine adapter when wired.
          }
        : undefined,
    },
  );

  useEffect(() => {
    if (mode !== "chesscom") {
      return;
    }

    if (!online.fen || online.fen === chessBoard.fen) {
      return;
    }

    chessBoard.loadFen(online.fen);
  }, [mode, online.fen, chessBoard]);

  useEffect(() => {
    if (mode !== "chesscom" || online.bridgeConnection === "connected") {
      return;
    }

    const id = setInterval(() => {
      setSpinnerFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 120);

    return () => {
      clearInterval(id);
    };
  }, [mode, online.bridgeConnection]);

  useEffect(() => {
    if (mode !== "chesscom") {
      return;
    }

    const shouldLockDialog = online.bridgeConnection === "connected" && !online.players;

    if (shouldLockDialog) {
      setLockBridgeDialog(true);
      setDialogLines(DIALOG_BROWSER_START.lines);
      return;
    }

    if (lockBridgeDialog) {
      setLockBridgeDialog(false);
      setDialogLines(DIALOG_HOWTO.lines);
    }
  }, [mode, online.bridgeConnection, online.players, lockBridgeDialog]);

  const topPlayer = mode === "chesscom"
    ? (online.players?.top ?? CHESSCOM_TEMP_PLAYERS.top)
    : mockSnapshot.players.top;
  const bottomPlayer = mode === "chesscom"
    ? (online.players?.bottom ?? CHESSCOM_TEMP_PLAYERS.bottom)
    : mockSnapshot.players.bottom;
  const isBridgeWaitingForGame =
    mode === "chesscom" &&
    online.bridgeConnection === "connected" &&
    !online.players;

  const topIsActive = mode === "chesscom"
    ? online.activePlacement === "top"
    : chessBoard.turn === "b";
  const bottomIsActive = mode === "chesscom"
    ? online.activePlacement === "bottom"
    : chessBoard.turn === "w";
  const liveOrientation = mode === "chesscom" ? online.boardOrientation : null;
  const shouldFlipBoard = mode === "chesscom"
    ? liveOrientation === "b"
    : false;
  const bridgeLine = online.bridgeConnection === "connected"
    ? `${online.bridgeEndpoint}`
    : `${SPINNER_FRAMES[spinnerFrameIndex] ?? "⠋"} connecting`;
  const spinnerGlyph = SPINNER_FRAMES[spinnerFrameIndex] ?? "⠋";
  const footerTip = exitConfirmArmed
    ? "press ctrl+c again to exit"
    : detached
      ? `${mod("d")}: restore board`
      : `${mod("d")}: detach board`;

  const handleDialogChange = useCallback((lines: string[]) => {
    if (lockBridgeDialog) {
      return;
    }
    setDialogLines(lines);
  }, [lockBridgeDialog]);

  useBoardIpcServer(sessionId, {
    board: chessBoard.board,
    lastRealMove: chessBoard.lastRealMove,
    premoveJumps: chessBoard.premoveJumps,
    selectedSquare: chessBoard.selectedSquare,
    validMoves: chessBoard.validMoves,
    isFlipped: shouldFlipBoard,
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

  const handleBackToWelcome = useCallback(() => {
    if (childRef.current) {
      childRef.current.kill();
      childRef.current = null;
    }
    navigate("welcome");
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (exitConfirmTimerRef.current) {
        clearTimeout(exitConfirmTimerRef.current);
        exitConfirmTimerRef.current = null;
      }
    };
  }, []);

  useInput((input, key) => {
    if (key.tab || input === "\t") {
      handleBackToWelcome();
      return;
    }

    if (isBridgeWaitingForGame) {
      if (key.ctrl && input.toLowerCase() === "c") {
        if (exitConfirmArmed) {
          if (exitConfirmTimerRef.current) {
            clearTimeout(exitConfirmTimerRef.current);
            exitConfirmTimerRef.current = null;
          }

          if (childRef.current) {
            childRef.current.kill();
            childRef.current = null;
          }
          process.exit(0);
          return;
        }

        setExitConfirmArmed(true);
        if (exitConfirmTimerRef.current) {
          clearTimeout(exitConfirmTimerRef.current);
        }
        exitConfirmTimerRef.current = setTimeout(() => {
          setExitConfirmArmed(false);
          exitConfirmTimerRef.current = null;
        }, EXIT_CONFIRM_TIMEOUT_MS);

        return;
      }

      return;
    }

    if (key.escape) {
      if (chessBoard.selectedSquare) {
        chessBoard.clearSelection();
        return;
      }

      if (chessBoard.hasPremoves) {
        chessBoard.clearPremoves();
        return;
      }

      return;
    }

    if (exitConfirmArmed && !(key.ctrl && input.toLowerCase() === "c")) {
      setExitConfirmArmed(false);
      if (exitConfirmTimerRef.current) {
        clearTimeout(exitConfirmTimerRef.current);
        exitConfirmTimerRef.current = null;
      }
    }

    if (key.ctrl && input.toLowerCase() === "d") {
      toggleDetach();
      return;
    }

    if (key.ctrl && input.toLowerCase() === "c") {
      if (exitConfirmArmed) {
        if (exitConfirmTimerRef.current) {
          clearTimeout(exitConfirmTimerRef.current);
          exitConfirmTimerRef.current = null;
        }

        if (childRef.current) {
          childRef.current.kill();
          childRef.current = null;
        }
        process.exit(0);
        return;
      }

      setExitConfirmArmed(true);
      if (exitConfirmTimerRef.current) {
        clearTimeout(exitConfirmTimerRef.current);
      }
      exitConfirmTimerRef.current = setTimeout(() => {
        setExitConfirmArmed(false);
        exitConfirmTimerRef.current = null;
      }, EXIT_CONFIRM_TIMEOUT_MS);

      return;
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
      >
        <Box flexDirection="column" flexGrow={0} flexShrink={0}>
          <PlayerInfo {...topPlayer} width={playerInfoWidth} isActive={topIsActive} />
          <PlayerInfo {...bottomPlayer} width={playerInfoWidth} isActive={bottomIsActive} />
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
            onDialogChange={handleDialogChange}
            commands={mockSnapshot.commands}
            onMove={isBridgeWaitingForGame ? undefined : chessBoard.handleUserInput}
            onCommand={isBridgeWaitingForGame ? undefined : chessBoard.executeCommand}
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
        {mode === "chesscom" ? (
          <Box paddingX={1} flexShrink={0}>
            {online.bridgeConnection === "connected" ? (
              <Text color={BORDER_COLOR}>{bridgeLine}</Text>
            ) : (
              <Text color={BORDER_COLOR}>
                <Text color={SPINNER_COLOR}>{spinnerGlyph}</Text> connecting
              </Text>
            )}
          </Box>
        ) : null}
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
                isFlipped={shouldFlipBoard}
              />
            </>
          )}
        </Box>
        {/* footer hint */}
        <Box paddingX={1}>
          <Text color={exitConfirmArmed ? "#f5f682" : BORDER_COLOR}>{footerTip}</Text>
        </Box>
      </Box>
    </Box>
  );
};
