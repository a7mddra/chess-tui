import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Text } from "ink";
import { HighlightBox } from "@/components";
import {
  COMMANDS,
  DIALOG_HOWTO,
  DIALOG_INVALID_INPUT,
  searchCommands,
  formatShortcutLines,
} from "@/lib";
import { useInputHandler } from "./use-input-handler";
import { InputCaret } from "./InputCaret";
import { isValidAlgebraic } from "./validate";

const DIM_BG = "#2a2a2a";

type InputBoxProps = {
  width: number;
  onDialogChange: (lines: string[]) => void;
};

export const InputBox = ({
  width,
  onDialogChange,
}: InputBoxProps): React.JSX.Element => {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorTimer, setErrorTimer] = useState<NodeJS.Timeout | null>(null);
  const lastDialogRef = useRef("");

  const isCommandMode = value.startsWith("/");
  const filteredCommands = isCommandMode
    ? searchCommands(value, COMMANDS)
    : [];

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
    }
  }, [
    value,
    selectedIndex,
    isCommandMode,
    filteredCommands,
    errorTimer,
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
        if (chosen) {
          // TODO: dispatch command by chosen.id
        }
        setValue("");
        setCursor(0);
        setSelectedIndex(0);
        return;
      }

      if (isValidAlgebraic(submittedValue)) {
        // TODO: send move
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
    emitDialogChange(formatShortcutLines());
  }, [emitDialogChange]);

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
