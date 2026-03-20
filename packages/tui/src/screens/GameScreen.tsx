import React, { useState, useRef, useCallback, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { type ChildProcess } from "node:child_process";
import { Chess } from "chess.js";
import process from "node:process";
import { useRouter, type GameMode } from "@/router/AppRouter";
import { Board, InputBox, PlayerInfo } from "@/features";
import { useBoardIpcServer, useChessBoard } from "@/features/board/Board";
import { DvdBounce, HighlightBox, SpinnerText } from "@/components";
import {
  BOARD_THEME_OPTIONS,
  DEFAULT_BOARD_THEME_ID,
  spawnBoardWindow,
  openExternalUrl,
  DIALOG_HOWTO,
  DIALOG_BROWSER_START,
  DIALOG_DRAW_OFFERED,
  DIALOG_STOCKFISH,
  DIALOG_INVALID_ELO_INPUT,
  DIALOG_ELO_PROMPT,
  DIALOG_PROMOTION_PROMPT,
  DIALOG_INVALID_INPUT,
  DIALOG_BLACK_WON_RESIGNATION,
  DIALOG_WHITE_WON_RESIGNATION,
  chesscom,
  getMockGameSnapshot,
  useOnlineGame,
  useStockfishGame,
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
const ELO_INVALID_TIMEOUT_MS = 1800;
const STOCKFISH_LOADING_LABEL = "loading engine resources";
const STOCKFISH_READY_LABEL = "Stockfish v17.1.0";

const CHESSCOM_TEMP_PLAYERS = {
  top: {
    name: "Opponent",
    elo: null,
    clock: "00:00",
    captured: "",
    advantage: "",
  },
  bottom: {
    name: "You",
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
  const [pendingPromotionMove, setPendingPromotionMove] = useState<string | null>(null);
  const [dialogLines, setDialogLines] = useState<string[]>(() =>
    mode === "stockfish" ? DIALOG_STOCKFISH.lines : DIALOG_HOWTO.lines,
  );
  const [stockfishIntroOpen, setStockfishIntroOpen] = useState(true);
  const [eloPromptOpen, setEloPromptOpen] = useState(false);
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
  const eloInvalidTimerRef = useRef<NodeJS.Timeout | null>(null);
  const childRef = useRef<ChildProcess | null>(null);

  const sessionId = React.useMemo(
    () => Math.random().toString(36).slice(2, 9),
    [],
  );
  const mockSnapshot = getMockGameSnapshot(mode);
  const online = useOnlineGame(mode === "chesscom");
  const stockfish = useStockfishGame(mode === "stockfish");
  const lastEngineRequestFenRef = useRef<string | null>(null);

  const currentFen =
    mode === "chesscom"
      ? (online.fen ?? CHESS_START_FEN)
      : mode === "stockfish"
        ? stockfish.fen
        : mockSnapshot.fen;

  const chessBoard = useChessBoard(
    currentFen,
    (move) => {
      if (mode === "stockfish") {
        setStockfishIntroOpen(false);
        return;
      }

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
          : mode === "stockfish"
            ? stockfish.boardOrientation
          : undefined,
      onUndoFenDispatch:
        mode === "stockfish"
          ? (fen) => {
              stockfish.setFen(fen);
            }
          : undefined,
    },
  );

  useEffect(() => {
    if (mode === "chesscom") {
      if (!online.fen || online.fen === chessBoard.fen) {
        return;
      }

      chessBoard.loadFen(online.fen);
    }
  }, [mode, online.fen, chessBoard]);

  useEffect(() => {
    if (mode === "chesscom" && online.lastGameOver) {
      const cleaned = online.lastGameOver
        .replace(/^Game Over\s*/i, "")
        .replace(/\(\d+\)\s*/g, "");
      const lastParen = cleaned.lastIndexOf("(");
      const lines = lastParen > 0
        ? ["Game Over", cleaned.slice(0, lastParen).trim(), cleaned.slice(lastParen).trim()]
        : ["Game Over", cleaned];
      setDialogLines(lines.filter(Boolean));
    }
  }, [mode, online.lastGameOver]);



  useEffect(() => {
    if (mode !== "stockfish") {
      return;
    }

    if (stockfish.gameOver || stockfish.thinking) {
      return;
    }

    if (chessBoard.turn === stockfish.boardOrientation) {
      return;
    }

    if (lastEngineRequestFenRef.current === chessBoard.fen) {
      return;
    }

    lastEngineRequestFenRef.current = chessBoard.fen;

    void (async () => {
      const result = await stockfish.requestEngineMove(chessBoard.fen);
      if (!result.ok) {
        lastEngineRequestFenRef.current = null;
        return;
      }

      if (result.fen && result.fen !== chessBoard.fen) {
        chessBoard.loadFen(result.fen);
      }
    })();
  }, [
    mode,
    chessBoard,
    stockfish.requestEngineMove,
    chessBoard.fen,
    chessBoard.turn,
    stockfish.boardOrientation,
    stockfish.gameOver,
    stockfish.thinking,
  ]);

  const topPlayer =
    mode === "chesscom"
      ? (online.players?.top ?? CHESSCOM_TEMP_PLAYERS.top)
      : mode === "stockfish"
        ? stockfish.players.top
        : mockSnapshot.players.top;
  const bottomPlayer =
    mode === "chesscom"
      ? (online.players?.bottom ?? CHESSCOM_TEMP_PLAYERS.bottom)
      : mode === "stockfish"
        ? stockfish.players.bottom
        : mockSnapshot.players.bottom;
  const isBridgeWaitingForGame =
    mode === "chesscom" &&
    online.bridgeConnection === "connected" &&
    !online.orientationReady;

  const topIsActive =
    mode === "chesscom"
      ? online.activePlacement === "top"
      : mode === "stockfish"
        ? stockfish.activePlacement === "top"
        : chessBoard.turn === "b";
  const bottomIsActive =
    mode === "chesscom"
      ? online.activePlacement === "bottom"
      : mode === "stockfish"
        ? stockfish.activePlacement === "bottom"
        : chessBoard.turn === "w";
  const liveOrientation =
    mode === "chesscom"
      ? online.boardOrientation
      : mode === "stockfish"
        ? stockfish.boardOrientation
        : null;
  const shouldFlipBoard = liveOrientation === "b";
  const bridgeLine =
    online.bridgeConnection === "connected"
      ? `${online.bridgeEndpoint}`
      : "connecting";
  const stockfishLine =
    stockfish.connection === "ready"
      ? STOCKFISH_READY_LABEL
      : STOCKFISH_LOADING_LABEL;
  const defaultDialogLines = pendingPromotionMove
    ? DIALOG_PROMOTION_PROMPT.lines
    : isBridgeWaitingForGame
      ? DIALOG_BROWSER_START.lines
      : mode === "chesscom"
        ? (online.lastDrawOfferedAt ? DIALOG_DRAW_OFFERED.lines : DIALOG_HOWTO.lines)
        : mode === "stockfish"
          ? (stockfish.gameOver
            ? (stockfish.winner === "w"
                ? DIALOG_WHITE_WON_RESIGNATION.lines
                : DIALOG_BLACK_WON_RESIGNATION.lines)
            : stockfishIntroOpen ? DIALOG_STOCKFISH.lines : DIALOG_HOWTO.lines)
          : DIALOG_HOWTO.lines;
  const lockDialog = themePickerOpen || pendingPromotionMove !== null;
  const activeThemeId = themePickerOpen
    ? (BOARD_THEME_OPTIONS[themePickerIndex]?.id ?? boardThemeId)
    : boardThemeId;
  const footerTip = exitConfirmArmed
    ? "press ctrl+c again to exit"
    : detached
      ? `${mod("d")} to restore board`
      : `${mod("d")} to detach board`;
  const showStockfishLoading =
    mode === "stockfish" && stockfish.connection !== "ready";

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

      if (mode === "stockfish" && eloPromptOpen) {
        return;
      }

      setDialogLines(lines);
    },
    [lockDialog, mode, eloPromptOpen],
  );

  const handleTextSubmit = useCallback(
    (value: string): boolean => {
      if (pendingPromotionMove) {
        if (eloInvalidTimerRef.current) {
          clearTimeout(eloInvalidTimerRef.current);
          eloInvalidTimerRef.current = null;
        }

        const char = value.trim().toLowerCase();
        if (["q", "r", "b", "n"].includes(char)) {
          const fullMove = pendingPromotionMove + char;
          setPendingPromotionMove(null);
          chessBoard.handleUserInput(fullMove);
          return true;
        }

        setDialogLines(DIALOG_INVALID_INPUT.lines);
        eloInvalidTimerRef.current = setTimeout(() => {
          setDialogLines(DIALOG_PROMOTION_PROMPT.lines);
          eloInvalidTimerRef.current = null;
        }, ELO_INVALID_TIMEOUT_MS);
        return true;
      }

      if (mode !== "stockfish" || !eloPromptOpen) {
        return false;
      }

      if (eloInvalidTimerRef.current) {
        clearTimeout(eloInvalidTimerRef.current);
        eloInvalidTimerRef.current = null;
      }

      const normalized = value.trim();
      if (!/^\d+$/.test(normalized)) {
        setDialogLines(DIALOG_INVALID_ELO_INPUT.lines);
        eloInvalidTimerRef.current = setTimeout(() => {
          setDialogLines(DIALOG_ELO_PROMPT.lines);
          eloInvalidTimerRef.current = null;
        }, ELO_INVALID_TIMEOUT_MS);
        return true;
      }

      const numeric = Number.parseInt(normalized, 10);
      if (Number.isNaN(numeric) || numeric < 100 || numeric > 3000) {
        setDialogLines(DIALOG_INVALID_ELO_INPUT.lines);
        eloInvalidTimerRef.current = setTimeout(() => {
          setDialogLines(DIALOG_ELO_PROMPT.lines);
          eloInvalidTimerRef.current = null;
        }, ELO_INVALID_TIMEOUT_MS);
        return true;
      }

      const finalElo = stockfish.setDifficultyElo(numeric);
      setEloPromptOpen(false);
      setDialogLines([
        `Engine elo set to ${finalElo}.`,
        "Use /diff to change again.",
      ]);
      return true;
    },
    [mode, eloPromptOpen, stockfish, pendingPromotionMove, chessBoard],
  );

  const handleMoveSubmit = useCallback((input: string) => {
    const normalized = input.trim().toLowerCase();
    const isCoordLike = /^([a-h][1-8]-?[a-h][1-8]-?[qrbn]?|[a-h][1-8]-?[qrbn]?)$/.test(normalized);
    const passToBoard = isCoordLike ? normalized.replace(/-/g, '') : normalized;

    let checkPromotionMove = passToBoard;

    if (chessBoard.selectedSquare && /^[a-h][1-8][qrbn]?$/.test(passToBoard)) {
      checkPromotionMove = chessBoard.selectedSquare + passToBoard;
    }

    if (/^[a-h][1-8][a-h][1-8]$/.test(checkPromotionMove)) {
      const from = checkPromotionMove.substring(0, 2);
      const to = checkPromotionMove.substring(2, 4);
      try {
        const testChess = new Chess(chessBoard.fen);
        const moveWithQ = testChess.move({ from, to, promotion: 'q' });
        if (moveWithQ) {
          const testChess2 = new Chess(chessBoard.fen);
          let normalValid = false;
          try {
            if (testChess2.move({ from, to })) {
               normalValid = true;
            }
          } catch {
             normalValid = false;
          }
          if (!normalValid) {
            if (checkPromotionMove.length === 4) {
              setPendingPromotionMove(checkPromotionMove);
              setDialogLines(DIALOG_PROMOTION_PROMPT.lines);
              chessBoard.clearSelection();
              return;
            }
          }
        }
      } catch {
        // ignore and let chessBoard.handleUserInput throw its own error if any
      }
    }

    chessBoard.handleUserInput(passToBoard);
  }, [chessBoard]);

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

      if (mode === "chesscom") {
        if (["new", "resign", "draw", "accept", "decline"].includes(commandId)) {
          if (commandId === "new") {
            chessBoard.clearPremoves();
            chessBoard.clearSelection();
            chessBoard.loadFen(CHESS_START_FEN);
            setDialogLines(DIALOG_BROWSER_START.lines);
          } else if (commandId === "resign") {
            setDialogLines(["Game Over", "You resigned."]);
          } else if (commandId === "draw") {
            setDialogLines(["Draw offered..."]);
          }
          void online.sendInteraction(commandId as any);
          return;
        }

        if (commandId === "analyze") {
          if (online.gameId) {
            void openExternalUrl(chesscom.analyze(online.gameId));
            setDialogLines(["Opening game review in browser..."]);
          } else {
            setDialogLines(["Error: Game ID not available yet."]);
          }
          return;
        }
      }

      if (mode === "stockfish") {
        if (commandId === "new") {
          if (eloInvalidTimerRef.current) {
            clearTimeout(eloInvalidTimerRef.current);
            eloInvalidTimerRef.current = null;
          }
          const fen = stockfish.startNewGame();
          lastEngineRequestFenRef.current = null;
          setStockfishIntroOpen(true);
          setEloPromptOpen(false);
          setPendingPromotionMove(null);
          chessBoard.loadFen(fen);
          chessBoard.clearPremoves();
          chessBoard.clearSelection();
          setDialogLines(DIALOG_STOCKFISH.lines);
          return;
        }

        if (commandId === "resign") {
          if (eloInvalidTimerRef.current) {
            clearTimeout(eloInvalidTimerRef.current);
            eloInvalidTimerRef.current = null;
          }
          const { winner } = stockfish.resignGame();
          setEloPromptOpen(false);
          setDialogLines(
            winner === "w"
              ? DIALOG_WHITE_WON_RESIGNATION.lines
              : DIALOG_BLACK_WON_RESIGNATION.lines,
          );
          return;
        }

        if (commandId === "flip") {
          if (eloInvalidTimerRef.current) {
            clearTimeout(eloInvalidTimerRef.current);
            eloInvalidTimerRef.current = null;
          }
          const fen = stockfish.flipSide();
          lastEngineRequestFenRef.current = null;
          setStockfishIntroOpen(true);
          setEloPromptOpen(false);
          chessBoard.loadFen(fen);
          chessBoard.clearPremoves();
          chessBoard.clearSelection();
          setDialogLines(DIALOG_STOCKFISH.lines);
          return;
        }

        if (commandId === "diff" || commandId === "difficulty") {
          if (eloInvalidTimerRef.current) {
            clearTimeout(eloInvalidTimerRef.current);
            eloInvalidTimerRef.current = null;
          }
          setEloPromptOpen(true);
          setDialogLines(DIALOG_ELO_PROMPT.lines);
          return;
        }
      }

      if (commandId === "exit") {
        process.exit(0);
      }

      chessBoard.executeCommand(commandId);
    },
    [boardThemeId, buildThemeDialogLines, chessBoard, mode, stockfish, online],
  );

  useEffect(() => {
    return () => {
      if (exitConfirmTimerRef.current) {
        clearTimeout(exitConfirmTimerRef.current);
        exitConfirmTimerRef.current = null;
      }

      if (eloInvalidTimerRef.current) {
        clearTimeout(eloInvalidTimerRef.current);
        eloInvalidTimerRef.current = null;
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

    if (eloPromptOpen) {
      if (key.escape) {
        if (eloInvalidTimerRef.current) {
          clearTimeout(eloInvalidTimerRef.current);
          eloInvalidTimerRef.current = null;
        }
        setEloPromptOpen(false);
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

  return showStockfishLoading ? (
    <Box width={columns} height={rows} justifyContent="center" alignItems="center">
      <Text color={BORDER_COLOR}>
        <SpinnerText color={SPINNER_COLOR} /> {STOCKFISH_LOADING_LABEL}
      </Text>
    </Box>
  ) : (
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
            onTextSubmit={handleTextSubmit}
            onMove={
              isBridgeWaitingForGame ? undefined : handleMoveSubmit
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
        ) : mode === "stockfish" ? (
          <Box paddingX={1} flexShrink={0}>
            {stockfish.connection !== "ready" ? (
              <Text color={BORDER_COLOR}>
                <SpinnerText color={SPINNER_COLOR} /> {stockfishLine}
              </Text>
            ) : (
              <Text color={BORDER_COLOR}>{stockfishLine}</Text>
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
