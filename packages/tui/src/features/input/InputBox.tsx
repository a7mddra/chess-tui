import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { HighlightBox } from "@/components";
import { COMMANDS, DIALOG_HOWTO, DIALOG_INVALID_INPUT } from "@/lib";

const DIM_BG = "#2a2a2a";

type InputBoxProps = {
  width: number;
  onDialogChange: (lines: string[]) => void;
};

const isValidAlgebraic = (move: string): boolean => {
  // Matches e2e4, Nf3, O-O, O-O-O, exd5, e8=Q, etc.
  return /^([a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?|O-O(-O)?)$/i.test(
    move,
  );
};

export const InputBox = ({
  width,
  onDialogChange,
}: InputBoxProps): React.JSX.Element => {
  const [value, setValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorTimer, setErrorTimer] = useState<NodeJS.Timeout | null>(null);

  const isCommandMode = value.startsWith("/");

  const filteredCommands = isCommandMode
    ? COMMANDS.filter((c) => c.name.startsWith(value))
    : [];

  useEffect(() => {
    if (errorTimer) return; // Don't override error message while it's showing

    if (value === "") {
      onDialogChange(DIALOG_HOWTO.lines);
    } else if (isCommandMode) {
      if (filteredCommands.length === 0) {
        onDialogChange(["No matching command"]);
      } else {
        const safeIndex = Math.min(
          selectedIndex,
          Math.max(0, filteredCommands.length - 1),
        );
        if (safeIndex !== selectedIndex) {
          setSelectedIndex(safeIndex);
        }

        // Show up to 6 commands mapped around the selected index
        const start = Math.max(
          0,
          Math.min(safeIndex, filteredCommands.length - 6),
        );
        const visibleCommands = filteredCommands.slice(start, start + 6);

        const lines = visibleCommands.map((c, idx) => {
          const isSelected = start + idx === safeIndex;
          return `${isSelected ? ">" : " "} ${c.name.padEnd(12)} - ${c.description}`;
        });

        onDialogChange(lines);
      }
    } else {
      onDialogChange([
        "Type a move in algebraic notation",
        "(e.g., e2e4, Nf3, O-O)",
      ]);
    }
  }, [
    value,
    selectedIndex,
    isCommandMode,
    filteredCommands,
    errorTimer,
    onDialogChange,
  ]);

  useInput((input, key) => {
    if (errorTimer) {
      // If showing error, any key press clears it and resets input
      clearTimeout(errorTimer);
      setErrorTimer(null);
      setValue("");
      return;
    }

    if (key.return) {
      if (value === "") return;

      if (isCommandMode) {
        // TODO: Execute command, for now just clear
        setValue("");
        setSelectedIndex(0);
      } else {
        if (isValidAlgebraic(value)) {
          // TODO: Send move, for now just clear
          setValue("");
        } else {
          onDialogChange(DIALOG_INVALID_INPUT.lines);
          const t = setTimeout(() => {
            setErrorTimer(null);
            setValue("");
          }, 2000);
          setErrorTimer(t);
        }
      }
    } else if (key.escape) {
      setValue("");
      setSelectedIndex(0);
    } else if (key.upArrow) {
      if (isCommandMode) {
        setSelectedIndex((i) => Math.max(0, i - 1));
      }
    } else if (key.downArrow) {
      if (isCommandMode) {
        setSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
      }
    } else if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setSelectedIndex(0); // Reset index on backspace to avoid jumps
    } else if (input && input.length === 1) {
      setValue((v) => v + input);
      setSelectedIndex(0); // Reset index on new character typed
    }
  });

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={DIM_BG}>{"▄".repeat(Math.max(0, width))}</Text>
      <HighlightBox
        label={value === "" ? "e2e4, / for cmds" : value}
        width={width}
        height={1}
        align="left"
      />
      <Text color={DIM_BG}>{"▀".repeat(Math.max(0, width))}</Text>
    </Box>
  );
};
