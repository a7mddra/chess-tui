import { useInput } from "ink";
import type { Command } from "@/lib";

type UseInputHandlerOptions = {
  value: string;
  cursor: number;
  selectedIndex: number;
  filteredCommands: Command[];
  errorTimer: NodeJS.Timeout | null;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setErrorTimer: React.Dispatch<React.SetStateAction<NodeJS.Timeout | null>>;
  onSubmit: (value: string) => void;
  onShortcutsRequest: () => void;
  onAnyAction?: () => void;
};

export const useInputHandler = ({
  value,
  cursor,
  selectedIndex,
  filteredCommands,
  errorTimer,
  setValue,
  setCursor,
  setSelectedIndex,
  setErrorTimer,
  onSubmit,
  onShortcutsRequest,
  onAnyAction,
}: UseInputHandlerOptions): void => {
  useInput((_input, key) => {
    onAnyAction?.();

    if (errorTimer) {
      clearTimeout(errorTimer);
      setErrorTimer(null);
      setValue("");
      setCursor(0);
      return;
    }

    if (key.home) {
      setCursor(0);
      return;
    }
    if (key.end) {
      setCursor(value.length);
      return;
    }

    const isCommandMode = value.startsWith("/");

    if (key.return) {
      onSubmit(value);
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
      if (cursor > 0) {
        setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
        setCursor((c) => Math.max(0, c - 1));
        setSelectedIndex(0);
      }
    } else if (key.backspace) {
      if (cursor < value.length) {
        setValue((v) => v.slice(0, cursor) + v.slice(cursor + 1));
        setSelectedIndex(0);
      }
    } else if (_input && !key.ctrl && !key.meta) {
      if (_input === "?" && value === "") {
        onShortcutsRequest();
        return;
      }
      setValue((v) => v.slice(0, cursor) + _input + v.slice(cursor));
      setCursor((c) => c + _input.length);
      setSelectedIndex(0);
    }
  });
};
