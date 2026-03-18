import React, { useState, useRef, useCallback, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { ChildProcess } from "node:child_process";
import process from "node:process";
import { useRouter, type GameMode } from "@/router/AppRouter";
import { Board, InputBox, PlayerInfo } from "@/features";
import { useChessBoard } from "@/features/board/use-chess-board";
import { DvdBounce, HighlightBox, SpinnerText } from "@/components";
import {
  BOARD_THEME_OPTIONS,
  DEFAULT_BOARD_THEME_ID,
  spawnBoardWindow,
  useBoardIpcServer,
  DIALOG_HOWTO,
  DIALOG_BROWSER_START,
  getMockGameSnapshot,
  useChesscomOnlineGame,
  saveUserPreferences,
  loadUserPreferences,
  type BoardThemeId,
  UI_COLORS,
  mod,
} from "@/lib";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = UI_COLORS.accent;
const BORDER_COLOR = UI_COLORS.border;
const SPINNER_COLOR = UI_COLORS.spinner;

const BOARD_WIDTH = 50;
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;
const CHESS_START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const EXIT_CONFIRM_TIMEOUT_MS = 2000;

const CHESSCOM_TEMP_PLAYERS = {
  top: {
    name: "Player 1",
    elo: null,
    clock: "00:00",
    captured: "",
    advantage: "",
  },
  bottom: {
    name: "Player 2",
    elo: null,
    clock: "00:00",
    captured: "",
    advantage: "",
  },
};

// ---------------------------------------------------------------------------
// GameScreen
// ---------------------------------------------------------------------------

type GameScreenProps = {
  mode: GameMode;
};

export const GameScreen = ({ mode }: GameScreenProps): React.JSX.Element => {
  const { navigate } = useRouter();
  const { stdout } = useStdout();

  const columns = stdout.columns ?? 80;
  const rows = stdout.rows ?? 24;

  const boardWidth = Math.min(BOARD_WIDTH, columns - 25);
  const panelWidth = columns - boardWidth;
  const playerInfoWidth = Math.max(18, panelWidth - 4);

  const [detached, setDetached] = useState(false);
  const [dialogLines, setDialogLines] = useState<string[]>(DIALOG_HOWTO.lines);
  const [exitConfirmArmed, setExitConfirmArmed] = useState(false);
  const [boardThemeId, setBoardThemeId] = useState<BoardThemeId>(
    () => loadUserPreferences().boardTheme,
  );
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [themePickerIndex, setThemePickerIndex] = useState(() => {
    const theme = loadUserPreferences().boardTheme;
    const activeIndex = BOARD_THEME_OPTIONS.findIndex(
      (option) => option.id === theme,
    );
    return activeIndex >= 0 ? activeIndex : 0;
  });
  const exitConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const childRef = useRef<ChildProcess | null>(null);

  const sessionId = React.useMemo(
    () => Math.random().toString(36).slice(2, 9),
    [],
  );
  const mockSnapshot = getMockGameSnapshot(mode);
  const online = useChesscomOnlineGame(mode === "chesscom");

  const currentFen =
    mode === "chesscom" ? (online.fen ?? CHESS_START_FEN) : mockSnapshot.fen;

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
      playerColor:
        mode === "chesscom"
          ? (online.boardOrientation ?? undefined)
          : undefined,
      onUndoFenDispatch:
        mode === "stockfish"
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

  const topPlayer =
    mode === "chesscom"
      ? (online.players?.top ?? CHESSCOM_TEMP_PLAYERS.top)
      : mockSnapshot.players.top;
  const bottomPlayer =
    mode === "chesscom"
      ? (online.players?.bottom ?? CHESSCOM_TEMP_PLAYERS.bottom)
      : mockSnapshot.players.bottom;
  const isBridgeWaitingForGame =
    mode === "chesscom" &&
    online.bridgeConnection === "connected" &&
    !online.orientationReady;

  const topIsActive =
    mode === "chesscom"
      ? online.activePlacement === "top"
      : chessBoard.turn === "b";
  const bottomIsActive =
    mode === "chesscom"
      ? online.activePlacement === "bottom"
      : chessBoard.turn === "w";
  const liveOrientation = mode === "chesscom" ? online.boardOrientation : null;
  const shouldFlipBoard = mode === "chesscom" ? liveOrientation === "b" : false;
  const bridgeLine =
    online.bridgeConnection === "connected"
      ? `${online.bridgeEndpoint}`
      : "connecting";
  const defaultDialogLines = isBridgeWaitingForGame
    ? DIALOG_BROWSER_START.lines
    : DIALOG_HOWTO.lines;
  const lockDialog = themePickerOpen;
  const activeThemeId = themePickerOpen
    ? (BOARD_THEME_OPTIONS[themePickerIndex]?.id ?? boardThemeId)
    : boardThemeId;
  const footerTip = exitConfirmArmed
    ? "press ctrl+c again to exit"
    : detached
      ? `${mod("d")} to restore board`
      : `${mod("d")} to detach board`;

  const buildThemeDialogLines = useCallback(
    (selectedIndex: number): string[] => {
      const header = "Select board theme:";
      const lines = BOARD_THEME_OPTIONS.map((option, index) => {
        const marker = index === selectedIndex ? ">" : " ";
        const active = option.id === boardThemeId ? " (active)" : "";
        return `${marker} ${option.name}${active}`;
      });

      return [header, ...lines];
    },
    [boardThemeId],
  );

  const handleDialogChange = useCallback(
    (lines: string[]) => {
      if (lockDialog) {
        return;
      }
      setDialogLines(lines);
    },
    [lockDialog],
  );

  useBoardIpcServer(sessionId, {
    board: chessBoard.board,
    lastRealMove: chessBoard.lastRealMove,
    premoveJumps: chessBoard.premoveJumps,
    selectedSquare: chessBoard.selectedSquare,
    validMoves: chessBoard.validMoves,
    isFlipped: shouldFlipBoard,
    themeId: activeThemeId,
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

  const handleCommand = useCallback(
    (commandId: string) => {
      if (commandId === "theme") {
        const activeIndex = BOARD_THEME_OPTIONS.findIndex(
          (option) => option.id === boardThemeId,
        );
        const nextIndex = activeIndex >= 0 ? activeIndex : 0;
        setThemePickerIndex(nextIndex);
        setThemePickerOpen(true);
        setDialogLines(buildThemeDialogLines(nextIndex));
        return;
      }

      chessBoard.executeCommand(commandId);
    },
    [boardThemeId, buildThemeDialogLines, chessBoard],
  );

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

    if (themePickerOpen) {
      if (key.escape) {
        setThemePickerOpen(false);
        setDialogLines(defaultDialogLines);
        return;
      }

      if (key.upArrow) {
        setThemePickerIndex((previous) => {
          const next =
            (previous - 1 + BOARD_THEME_OPTIONS.length) %
            BOARD_THEME_OPTIONS.length;
          setDialogLines(buildThemeDialogLines(next));
          return next;
        });
        return;
      }

      if (key.downArrow) {
        setThemePickerIndex((previous) => {
          const next = (previous + 1) % BOARD_THEME_OPTIONS.length;
          setDialogLines(buildThemeDialogLines(next));
          return next;
        });
        return;
      }

      if (key.return) {
        const picked =
          BOARD_THEME_OPTIONS[themePickerIndex]?.id ?? DEFAULT_BOARD_THEME_ID;
        setBoardThemeId(picked);
        saveUserPreferences({ boardTheme: picked });
        setThemePickerOpen(false);
        setDialogLines(defaultDialogLines);
        return;
      }

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
          <PlayerInfo
            {...topPlayer}
            width={playerInfoWidth}
            isActive={topIsActive}
          />
          <PlayerInfo
            {...bottomPlayer}
            width={playerInfoWidth}
            isActive={bottomIsActive}
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
            onDialogChange={handleDialogChange}
            commands={mockSnapshot.commands}
            disabled={themePickerOpen}
            onMove={
              isBridgeWaitingForGame ? undefined : chessBoard.handleUserInput
            }
            onCommand={handleCommand}
            defaultDialogLines={defaultDialogLines}
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
                <SpinnerText color={SPINNER_COLOR} /> {bridgeLine}
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
                themeId={activeThemeId}
              />
            </>
          )}
        </Box>
        {/* footer hint */}
        <Box paddingX={1}>
          <Text color={exitConfirmArmed ? UI_COLORS.warning : BORDER_COLOR}>
            {footerTip}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
