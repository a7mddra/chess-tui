import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import { HighlightBox } from "@/components";
import {
  type Command,
  DIALOG_HOWTO,
  DIALOG_INVALID_INPUT,
  searchCommands,
  formatShortcutLines,
  UI_COLORS,
} from "@/lib";
import { useInputHandler } from "./use-input-handler";
import { InputCaret } from "./InputCaret";
import { isValidAlgebraic } from "./validate";

const DIM_BG = UI_COLORS.dimBackground;
const SHORTCUT_TIP_MARKER = "? for shortcuts";

type InputBoxProps = {
  width: number;
  onDialogChange: (lines: string[]) => void;
  commands: Command[];
  onMove?: (uci: string) => void;
  onTextSubmit?: (value: string) => boolean;
  onCommand?: (id: string) => void;
  disabled?: boolean;
  defaultDialogLines?: string[];
};

export const InputBox = ({
  width,
  onDialogChange,
  commands,
  onMove,
  onTextSubmit,
  onCommand,
  disabled = false,
  defaultDialogLines,
}: InputBoxProps): React.JSX.Element => {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorTimer, setErrorTimer] = useState<NodeJS.Timeout | null>(null);
  const [showingShortcuts, setShowingShortcuts] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyDraft, setHistoryDraft] = useState("");
  const [isNavigatingHistory, setIsNavigatingHistory] = useState(false);
  const lastDialogRef = useRef("");

  const isCommandMode = value.startsWith("/");
  const filteredCommands = isCommandMode ? searchCommands(value, commands) : [];
  const allowUndoShortcut = commands.some((c) => c.id === "undo");
  const defaultLines = defaultDialogLines ?? DIALOG_HOWTO.lines;
  const showCommandsDropdown = isCommandMode && !isNavigatingHistory;
  const dirtyHowtoLines = defaultLines.filter(
    (line) => !line.includes(SHORTCUT_TIP_MARKER),
  );

  const emitDialogChange = useCallback(
    (lines: string[]) => {
      const signature = lines.join("\n");
      if (signature === lastDialogRef.current) return;
      lastDialogRef.current = signature;
      onDialogChange(lines);
    },
    [onDialogChange],
  );

  useEffect(() => {
    if (errorTimer) return;

    if (value === "") {
      if (showingShortcuts) return;
      emitDialogChange(defaultLines);
    } else if (showCommandsDropdown) {
      if (filteredCommands.length === 0) {
        emitDialogChange(["No matching command"]);
      } else {
        const safeIndex = Math.min(
          selectedIndex,
          Math.max(0, filteredCommands.length - 1),
        );
        if (safeIndex !== selectedIndex) setSelectedIndex(safeIndex);

        const start = Math.max(
          0,
          Math.min(safeIndex, filteredCommands.length - 6),
        );
        const visibleCommands = filteredCommands.slice(start, start + 6);

        const lines = visibleCommands.map((c, idx) => {
          const isSelected = start + idx === safeIndex;
          return `${isSelected ? ">" : " "} /${c.label}`;
        });

        emitDialogChange(lines);
      }
    } else {
      emitDialogChange(dirtyHowtoLines);
    }
  }, [
    value,
    selectedIndex,
    isCommandMode,
    filteredCommands,
    dirtyHowtoLines,
    defaultLines,
    errorTimer,
    showingShortcuts,
    showCommandsDropdown,
    emitDialogChange,
  ]);

  useEffect(
    () => () => {
      if (errorTimer) clearTimeout(errorTimer);
    },
    [errorTimer],
  );

  const handleSubmit = useCallback(
    (submittedValue: string) => {
      if (errorTimer || submittedValue === "") return;

      const normalized = submittedValue.trim();

      if (isCommandMode) {
        const chosen = filteredCommands[selectedIndex];
        if (chosen) {
          setHistory((prev) => [...prev, `/${chosen.label}`]);
          if (onCommand) {
            onCommand(chosen.id);
          }
        } else {
          setHistory((prev) => [...prev, normalized]);
        }
        setHistoryIndex(-1);
        setHistoryDraft("");
        setValue("");
        setCursor(0);
        setSelectedIndex(0);
        setIsNavigatingHistory(false);
        return;
      }

      if (normalized !== "") {
        setHistory((prev) => [...prev, normalized]);
      }
      setHistoryIndex(-1);
      setHistoryDraft("");

      if (onTextSubmit?.(normalized)) {
        setValue("");
        setCursor(0);
        setIsNavigatingHistory(false);
        return;
      }

      if (isValidAlgebraic(submittedValue)) {
        if (onMove) {
          onMove(submittedValue);
        }
        setValue("");
        setCursor(0);
        setIsNavigatingHistory(false);
        return;
      }

      emitDialogChange(DIALOG_INVALID_INPUT.lines);
      const t = setTimeout(() => {
        setErrorTimer(null);
        setValue("");
        setCursor(0);
        setSelectedIndex(0);
        setIsNavigatingHistory(false);
      }, 2000);
      setErrorTimer(t);
    },
    [
      errorTimer,
      isCommandMode,
      filteredCommands,
      selectedIndex,
      emitDialogChange,
      onCommand,
      onTextSubmit,
      onMove,
    ],
  );

  const handleHistoryUp = useCallback((): boolean => {
    if (history.length === 0) {
      return false;
    }

    const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);

    if (historyIndex === -1) {
      setHistoryDraft(value);
    }

    const nextValue = history[nextIndex] ?? "";
    setHistoryIndex(nextIndex);
    setValue(nextValue);
    setCursor(nextValue.length);
    setSelectedIndex(0);
    setIsNavigatingHistory(true);
    return true;
  }, [history, historyIndex, value]);

  const handleHistoryDown = useCallback((): boolean => {
    if (history.length === 0 || historyIndex === -1) {
      return false;
    }

    if (historyIndex >= history.length - 1) {
      setHistoryIndex(-1);
      setValue(historyDraft);
      setCursor(historyDraft.length);
      setSelectedIndex(0);
      setIsNavigatingHistory(false);
      return true;
    }

    const nextIndex = historyIndex + 1;
    const nextValue = history[nextIndex] ?? "";
    setHistoryIndex(nextIndex);
    setValue(nextValue);
    setCursor(nextValue.length);
    setSelectedIndex(0);
    setIsNavigatingHistory(true);
    return true;
  }, [history, historyIndex, historyDraft]);

  const handleShortcutsRequest = useCallback(() => {
    setShowingShortcuts(true);
    emitDialogChange(formatShortcutLines({ includeUndo: allowUndoShortcut }));
  }, [emitDialogChange, allowUndoShortcut]);

  const handleAnyAction = useCallback(() => {
    if (showingShortcuts) {
      setShowingShortcuts(false);
    }
  }, [showingShortcuts]);

  const handleUndoRequest = useCallback(() => {
    if (!allowUndoShortcut) {
      return;
    }
    if (onCommand) {
      onCommand("undo");
    }
    setSelectedIndex(0);
  }, [onCommand, allowUndoShortcut]);

  useInputHandler({
    disabled,
    value,
    cursor,
    selectedIndex,
    filteredCommands,
    errorTimer,
    setValue,
    setCursor,
    setSelectedIndex,
    setErrorTimer,
    onSubmit: handleSubmit,
    onShortcutsRequest: handleShortcutsRequest,
    onUndoRequest: handleUndoRequest,
    onHistoryUp: handleHistoryUp,
    onHistoryDown: handleHistoryDown,
    onEdit: () => setIsNavigatingHistory(false),
    isNavigatingHistory,
    onAnyAction: handleAnyAction,
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={DIM_BG}>{"▄".repeat(Math.max(0, width))}</Text>
      <HighlightBox label={""} width={width} height={1} align="left" />
      <InputCaret value={value} cursor={cursor} width={width} />
      <Text color={DIM_BG}>{"▀".repeat(Math.max(0, width))}</Text>
    </Box>
  );
};
