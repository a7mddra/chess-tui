import React from "react";
import { Box, Text } from "ink";
import { Square } from "chess.js";
import {
  BOARD_THEMES,
  DEFAULT_BOARD_THEME_ID,
  UI_COLORS,
  type BoardThemeId,
} from "@/lib";
import type { BoardCell } from "./types";
import { getPieceGlyph, isPieceKind } from "./piece";
export { useBoardIpcServer, useBoardIpcClient, useChessBoard } from "./use-chess-board";

const FILES = "abcdefgh";

export type BoardProps = {
  board: BoardCell[][];
  lastRealMove: { from: string; to: string } | null;
  premoveJumps: string[];
  selectedSquare: string | null;
  validMoves: string[];
  isFlipped?: boolean;
  themeId?: BoardThemeId;
};

const getSquareId = (r: number, c: number): Square => {
  const file = FILES[c];
  const rank = 8 - r;
  return `${file}${rank}` as Square;
};

const getBgColor = (
  r: number,
  c: number,
  sq: Square,
  lastRealMove: { from: string; to: string } | null,
  premoveJumps: string[],
  selectedSquare: string | null,
  themeId: BoardThemeId,
): string => {
  const theme = BOARD_THEMES[themeId];
  const isDark = (r + c) % 2 !== 0;
  
  const isLastMove = lastRealMove?.from === sq || lastRealMove?.to === sq;
  const isSelected = selectedSquare === sq;
  if (isLastMove || isSelected) {
    return isDark ? theme.highlightDark : theme.highlightLight;
  }

  const isPremoveJump = premoveJumps.includes(sq);
  if (isPremoveJump) {
    return isDark ? theme.premoveDark : theme.premoveLight;
  }

  return isDark ? theme.darkCell : theme.lightCell;
};

export const Board = ({
  board,
  lastRealMove,
  premoveJumps,
  selectedSquare,
  validMoves,
  isFlipped = false,
  themeId = DEFAULT_BOARD_THEME_ID,
}: BoardProps): React.JSX.Element => {
  
  const displayBoard = isFlipped ? [...board].reverse().map(row => [...row].reverse()) : board;
  const selectedPieceColor = (() => {
    if (!selectedSquare) {
      return null;
    }

    const file = selectedSquare.charAt(0);
    const rank = Number.parseInt(selectedSquare.charAt(1), 10);
    const col = FILES.indexOf(file);
    const row = 8 - rank;
    if (col < 0 || row < 0 || row > 7 || Number.isNaN(rank)) {
      return null;
    }

    return board[row]?.[col]?.color ?? null;
  })();
  
  return (
    <Box flexDirection="column">
      {displayBoard.map((row, visualRowIndex) => {
        const actualRowIndex = isFlipped ? 7 - visualRowIndex : visualRowIndex;
        const rankLabel = isFlipped ? visualRowIndex + 1 : 8 - visualRowIndex;

        return (
          <Text key={`rank-${rankLabel}`}>
            <Text color={UI_COLORS.boardCoords}>{`${rankLabel} `}</Text>
            {row.map((cell, visualColIndex) => {
              const actualColIndex = isFlipped ? 7 - visualColIndex : visualColIndex;
              const sq = getSquareId(actualRowIndex, actualColIndex);
              
              const bg = getBgColor(
                actualRowIndex,
                actualColIndex,
                sq,
                lastRealMove,
                premoveJumps,
                selectedSquare,
                themeId,
              );

              const isValidMove = validMoves.includes(sq);
              
              let char = " ";
              let color: string = UI_COLORS.textDefault;
              
              if (cell) {
                const kind = cell.type.toLowerCase();
                char = isPieceKind(kind) ? getPieceGlyph(kind, cell.color) : " ";
                if (isValidMove && selectedPieceColor && cell.color !== selectedPieceColor) {
                  // Capture square (only when target has enemy piece)
                  color = UI_COLORS.captureTarget;
                }
              } else if (isValidMove) {
                char = "•";
                color = (actualRowIndex + actualColIndex) % 2 !== 0
                  ? BOARD_THEMES[themeId].validMoveDotDark
                  : BOARD_THEMES[themeId].validMoveDotLight;
              }

              return (
                <Text
                  key={`cell-${sq}`}
                  backgroundColor={bg}
                  color={color}
                >
                  {` ${char} `}
                </Text>
              );
            })}
          </Text>
        );
      })}
      <Text>
        <Text color={UI_COLORS.boardCoords}>
          {" "}
          {" " + (isFlipped ? [...FILES].reverse() : [...FILES]).map((f) => ` ${f} `).join("")}
        </Text>
      </Text>
    </Box>
  );
};
