// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import React, { useEffect, useState } from "react";
import { Text } from "ink";

type SpinnerTextProps = {
  active?: boolean;
  color?: string;
  intervalMs?: number;
};

const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

export const SpinnerText = ({
  active = true,
  color,
  intervalMs = 120,
}: SpinnerTextProps): React.JSX.Element => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs]);

  const glyph = SPINNER_FRAMES[index] ?? SPINNER_FRAMES[0];

  return <Text color={color}>{glyph}</Text>;
};
