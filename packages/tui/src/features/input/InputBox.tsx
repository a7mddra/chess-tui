import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import { HighlightBox } from "@/components";
import {
  type Command,
  DIALOG_HOWTO,
  DIALOG_INVALID_INPUT,
  searchCommands,
  formatShortcutLines,
} from "@/lib";
import { useInputHandler } from "./use-input-handler";
import { InputCaret } from "./InputCaret";
import { isValidAlgebraic } from "./validate";

const DIM_BG = "#2a2a2a";
const SHORTCUT_TIP_MARKER = "? for shortcuts";

type InputBoxProps = {
  width: number;
  onDialogChange: (lines: string[]) => void;
  commands: Command[];
  onMove?: (uci: string) => void;
  onCommand?: (id: string) => void;
};

export const InputBox = ({
  width,
  onDialogChange,
  commands,
  onMove,
  onCommand,
}: InputBoxProps): React.JSX.Element => {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorTimer, setErrorTimer] = useState<NodeJS.Timeout | null>(null);
  const [showingShortcuts, setShowingShortcuts] = useState(false);
  const lastDialogRef = useRef("");

  const isCommandMode = value.startsWith("/");
  const filteredCommands = isCommandMode ? searchCommands(value, commands) : [];
  const dirtyHowtoLines = DIALOG_HOWTO.lines.filter(
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
      emitDialogChange(DIALOG_HOWTO.lines);
    } else if (isCommandMode) {
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
    errorTimer,
    showingShortcuts,
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

      if (isCommandMode) {
        const chosen = filteredCommands[selectedIndex];
        if (chosen && onCommand) {
          onCommand(chosen.id);
        }
        setValue("");
        setCursor(0);
        setSelectedIndex(0);
        return;
      }

      if (isValidAlgebraic(submittedValue)) {
        if (onMove) {
          onMove(submittedValue);
        }
        setValue("");
        setCursor(0);
        return;
      }

      emitDialogChange(DIALOG_INVALID_INPUT.lines);
      const t = setTimeout(() => {
        setErrorTimer(null);
        setValue("");
        setCursor(0);
        setSelectedIndex(0);
      }, 2000);
      setErrorTimer(t);
    },
    [
      errorTimer,
      isCommandMode,
      filteredCommands,
      selectedIndex,
      emitDialogChange,
    ],
  );

  const handleShortcutsRequest = useCallback(() => {
    setShowingShortcuts(true);
    emitDialogChange(formatShortcutLines());
  }, [emitDialogChange]);

  const handleAnyAction = useCallback(() => {
    if (showingShortcuts) {
      setShowingShortcuts(false);
    }
  }, [showingShortcuts]);

  useInputHandler({
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
