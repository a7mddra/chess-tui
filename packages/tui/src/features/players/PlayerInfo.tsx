// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import React from "react";
import { Box, Text } from "ink";
import { UI_COLORS } from "@/lib";
import { PIECES_BY_CODE } from "@/lib/chess/piece";

const CAPTURED_SORT_ORDER: Record<string, number> = {
  [PIECES_BY_CODE.P.glyph]: PIECES_BY_CODE.P.power,
  [PIECES_BY_CODE.p.glyph]: PIECES_BY_CODE.p.power,
  [PIECES_BY_CODE.N.glyph]: PIECES_BY_CODE.N.power,
  [PIECES_BY_CODE.n.glyph]: PIECES_BY_CODE.n.power,
  [PIECES_BY_CODE.B.glyph]: PIECES_BY_CODE.B.power,
  [PIECES_BY_CODE.b.glyph]: PIECES_BY_CODE.b.power,
  [PIECES_BY_CODE.R.glyph]: PIECES_BY_CODE.R.power,
  [PIECES_BY_CODE.r.glyph]: PIECES_BY_CODE.r.power,
  [PIECES_BY_CODE.Q.glyph]: PIECES_BY_CODE.Q.power,
  [PIECES_BY_CODE.q.glyph]: PIECES_BY_CODE.q.power,
  [PIECES_BY_CODE.K.glyph]: PIECES_BY_CODE.K.power,
  [PIECES_BY_CODE.k.glyph]: PIECES_BY_CODE.k.power,
};

function sortCapturedByPiecePower(captured: string): string {
  const symbols = Array.from(captured).filter(
    (ch) => CAPTURED_SORT_ORDER[ch] !== undefined,
  );
  const unknown = Array.from(captured).filter(
    (ch) => CAPTURED_SORT_ORDER[ch] === undefined,
  );

  symbols.sort((a, b) => {
    return CAPTURED_SORT_ORDER[a]! - CAPTURED_SORT_ORDER[b]!;
  });

  return [...symbols, ...unknown].join("");
}

export type PlayerInfoProps = {
  name: string;
  elo: number | null;
  clock: string;
  captured: string;
  advantage: string;
  width?: number;
  isActive?: boolean;
};

export const PlayerInfo = ({
  name,
  elo,
  clock,
  captured,
  advantage,
  width = 28,
  isActive = true,
}: PlayerInfoProps): React.JSX.Element => {
  const clockBadge = ` ◴ ${clock} `;
  const nameLabel = `${name} ${elo ? `(${elo})` : ""}`;
  const leftWidth = Math.max(0, width - clockBadge.length);
  const sortedCaptured = sortCapturedByPiecePower(captured);

  const clampedName =
    nameLabel.length > leftWidth
      ? `${nameLabel.slice(0, Math.max(0, leftWidth - 1))}…`
      : nameLabel;

  const firstLine = `${clampedName}${" ".repeat(Math.max(0, leftWidth - clampedName.length))}${clockBadge}`;

  const capturedLabel = `${sortedCaptured}${advantage ? ` ${advantage}` : ""}`;
  const secondLine =
    capturedLabel.length > width
      ? `${capturedLabel.slice(0, Math.max(0, width - 1))}…`
      : capturedLabel;
  const secondLinePadded = `${secondLine}${" ".repeat(Math.max(0, width - secondLine.length))}`;

  return (
    <Box flexDirection="column" paddingX={1} width={width + 2}>
      <Text bold dimColor={!isActive} wrap="truncate-end">
        <Text>{firstLine.slice(0, width)}</Text>
      </Text>
      <Text color={UI_COLORS.mutedAlt} dimColor={!isActive} wrap="truncate-end">
        {secondLinePadded.slice(0, width)}
      </Text>
    </Box>
  );
};
