import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { HighlightBox } from "@/components";
import {
  COMMANDS,
  DIALOG_HOWTO,
  DIALOG_INVALID_INPUT,
  searchCommands,
} from "@/lib";

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
  const [cursor, setCursor] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorTimer, setErrorTimer] = useState<NodeJS.Timeout | null>(null);
  const lastDialogRef = useRef("");

  const isCommandMode = value.startsWith("/");

  const filteredCommands = isCommandMode
    ? searchCommands(value, COMMANDS)
    : [];

  const emitDialogChange = (lines: string[]) => {
    const signature = lines.join("\n");
    if (signature === lastDialogRef.current) {
      return;
    }

    lastDialogRef.current = signature;
    onDialogChange(lines);
  };

  useEffect(() => {
    if (errorTimer) return; // Don't override error message while it's showing

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
          return `${isSelected ? ">" : " "} /${c.label}`;
        });

        emitDialogChange(lines);
      }
    } else {
      emitDialogChange([
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

  useEffect(
    () => () => {
      if (errorTimer) {
        clearTimeout(errorTimer);
      }
    },
    [errorTimer],
  );

  const handleSubmit = (submittedValue: string) => {
    if (errorTimer) {
      return;
    }

    if (submittedValue === "") {
      return;
    }

    if (isCommandMode) {
      const chosenCommand = filteredCommands[selectedIndex];
      if (chosenCommand) {
        // TODO: Execute chosenCommand
      }

      setValue("");
      setCursor(0);
      setSelectedIndex(0);
      return;
    }

    if (isValidAlgebraic(submittedValue)) {
      // TODO: Send move
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
  };

  useInput((_input, key) => {
    if (errorTimer) {
      // If showing error, any key press clears it and resets input
      clearTimeout(errorTimer);
      setErrorTimer(null);
      setValue("");
      setCursor(0);
      return;
    }

    // Home / End keys (Ink v6 native support)
    if (key.home) {
      setCursor(0);
      return;
    }
    if (key.end) {
      setCursor(value.length);
      return;
    }

    if (key.return) {
      handleSubmit(value);
    } else if (key.escape) {
      setValue("");
      setCursor(0);
      setSelectedIndex(0);
    } else if (key.leftArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.rightArrow) {
      setCursor((c) => Math.min(value.length, c + 1));
    } else if (key.ctrl && (_input ?? "").toLowerCase() === "a") {
      setCursor(0);
    } else if (key.ctrl && (_input ?? "").toLowerCase() === "e") {
      setCursor(value.length);
    } else if (key.upArrow) {
      if (isCommandMode) {
        setSelectedIndex((i) => Math.max(0, i - 1));
      }
    } else if (key.downArrow) {
      if (isCommandMode) {
        setSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
      }
    } else if (key.delete) {
      // Ink on Linux maps physical Backspace to key.delete
      if (cursor > 0) {
        setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
        setCursor((c) => Math.max(0, c - 1));
        setSelectedIndex(0);
      }
    } else if (key.backspace) {
      // Ink on Linux maps physical Delete to key.backspace
      if (cursor < value.length) {
        setValue((v) => v.slice(0, cursor) + v.slice(cursor + 1));
        setSelectedIndex(0);
      }
    } else if (_input && !key.ctrl && !key.meta) {
      setValue((v) => v.slice(0, cursor) + _input + v.slice(cursor));
      setCursor((c) => c + _input.length);
      setSelectedIndex(0);
    }
  });

  const isEmpty = value === "";
  const placeholder = "e2e4, / for cmds";
  const safeWidth = Math.max(0, width - 1);

  // When empty, cursor is a standalone block before the placeholder
  const displayText = isEmpty ? "" : value;
  const clampedCursor = Math.min(cursor, displayText.length);

  const before = displayText.slice(0, clampedCursor);
  const hasCursorChar = clampedCursor < displayText.length;
  const cursorChar = hasCursorChar ? (displayText[clampedCursor] ?? " ") : " ";
  const after = hasCursorChar
    ? displayText.slice(clampedCursor + 1)
    : displayText.slice(clampedCursor);

  const visibleBefore = before.slice(0, safeWidth);
  const remainingAfterBefore = Math.max(0, safeWidth - visibleBefore.length);
  const visibleCursor = remainingAfterBefore > 0 ? cursorChar : "";
  const remainingAfterCursor = Math.max(
    0,
    remainingAfterBefore - visibleCursor.length,
  );
  const visibleAfter = after.slice(0, remainingAfterCursor);
  const used =
    visibleBefore.length + visibleCursor.length + visibleAfter.length;

  // In placeholder mode, account for cursor + gap + placeholder text
  const placeholderGap = isEmpty ? " " : "";
  const placeholderSlice = isEmpty
    ? placeholder.slice(0, Math.max(0, safeWidth - used - placeholderGap.length))
    : "";
  const totalUsed = used + placeholderGap.length + placeholderSlice.length;
  const pad = Math.max(0, safeWidth - totalUsed);

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={DIM_BG}>{"▄".repeat(Math.max(0, width))}</Text>
      <HighlightBox label={""} width={width} height={1} align="left" />
      <Box position="absolute" marginTop={1} width={width}>
        <Text backgroundColor={DIM_BG}> </Text>
        <Text backgroundColor={DIM_BG} color={isEmpty ? "#555555" : "#666666"}>
          {visibleBefore}
        </Text>
        <Text backgroundColor="white" color="black">
          {visibleCursor}
        </Text>
        {isEmpty ? (
          <Text backgroundColor={DIM_BG} color="#555555">
            {placeholderGap}{placeholderSlice}
            {" ".repeat(pad)}
          </Text>
        ) : (
          <Text backgroundColor={DIM_BG} color="#666666">
            {visibleAfter}
            {" ".repeat(pad)}
          </Text>
        )}
      </Box>
      <Text color={DIM_BG}>{"▀".repeat(Math.max(0, width))}</Text>
    </Box>
  );
};
