import React from "react";
import { Box, Text } from "ink";
import { BoardCell } from "./use-chess-board";
import { Square } from "chess.js";

const LIGHT_CELL = "#ebecd0";
const DARK_CELL = "#739552";
const LIGHT_YELLOW = "#f5f682";
const DARK_YELLOW = "#b9ca43";
const LIGHT_RED = "#af2b2d";
const DARK_RED = "#b02c2c";
const PIECE_COLOR = "#000000";

const FILES = "abcdefgh";

const PIECE_SYMBOLS: Record<"w" | "b", Record<string, string>> = {
  w: { p: "♙", r: "♖", n: "♘", b: "♗", q: "♕", k: "♔" },
  b: { p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚" },
};

export type BoardProps = {
  board: BoardCell[][];
  lastRealMove: { from: string; to: string } | null;
  premoveJumps: string[];
  selectedSquare: string | null;
  validMoves: string[];
  isFlipped?: boolean;
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
  selectedSquare: string | null
): string => {
  const isDark = (r + c) % 2 !== 0;
  
  const isLastMove = lastRealMove?.from === sq || lastRealMove?.to === sq;
  const isSelected = selectedSquare === sq;
  if (isLastMove || isSelected) {
    return isDark ? DARK_YELLOW : LIGHT_YELLOW;
  }

  const isPremoveJump = premoveJumps.includes(sq);
  if (isPremoveJump) {
    return isDark ? DARK_RED : LIGHT_RED;
  }

  return isDark ? DARK_CELL : LIGHT_CELL;
};

export const Board = ({
  board,
  lastRealMove,
  premoveJumps,
  selectedSquare,
  validMoves,
  isFlipped = false,
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
            <Text color="#888888">{`${rankLabel} `}</Text>
            {row.map((cell, visualColIndex) => {
              const actualColIndex = isFlipped ? 7 - visualColIndex : visualColIndex;
              const sq = getSquareId(actualRowIndex, actualColIndex);
              
              const bg = getBgColor(
                actualRowIndex,
                actualColIndex,
                sq,
                lastRealMove,
                premoveJumps,
                selectedSquare
              );

              const isValidMove = validMoves.includes(sq);
              
              let char = " ";
              let color = PIECE_COLOR;
              
              if (cell) {
                char = PIECE_SYMBOLS[cell.color][cell.type] || " ";
                if (isValidMove && selectedPieceColor && cell.color !== selectedPieceColor) {
                  // Capture square (only when target has enemy piece)
                  color = "#ff0000";
                }
              } else if (isValidMove) {
                char = "•";
                color = (actualRowIndex + actualColIndex) % 2 !== 0 ? "#587040" : "#c4c4b3";
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
        <Text color="#888888">
          {" "}
          {" " + (isFlipped ? [...FILES].reverse() : [...FILES]).map((f) => ` ${f} `).join("")}
        </Text>
      </Text>
    </Box>
  );
};
