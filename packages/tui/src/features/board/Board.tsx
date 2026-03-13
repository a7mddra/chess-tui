import React from "react";
import { Box, Text } from "ink";

// ---------------------------------------------------------------------------
// Board colors (chess.com green theme)
// ---------------------------------------------------------------------------

const LIGHT_CELL = "#ebecd0";
const DARK_CELL = "#739552";
const PIECE_COLOR = "#000000";

// ---------------------------------------------------------------------------
// Starting position
// ---------------------------------------------------------------------------

const STARTING_POSITION: readonly (readonly string[])[] = [
  ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
  ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  [" ", " ", " ", " ", " ", " ", " ", " "],
  ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
  ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
] as const;

const FILES = "abcdefgh";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCellBg = (row: number, col: number): string =>
  (row + col) % 2 === 0 ? LIGHT_CELL : DARK_CELL;

// ---------------------------------------------------------------------------
// Board component
// ---------------------------------------------------------------------------

export const Board = (): React.JSX.Element => (
  <Box flexDirection="column">
    {STARTING_POSITION.map((row, rowIndex) => {
      const rank = 8 - rowIndex;

      return (
        <Text key={`rank-${rank}`}>
          <Text color="#888888">{`${rank} `}</Text>
          {row.map((piece, colIndex) => (
            <Text
              key={`cell-${rank}-${colIndex}`}
              backgroundColor={getCellBg(rowIndex, colIndex)}
              color={PIECE_COLOR}
            >
              {" "}
              {piece}{" "}
            </Text>
          ))}
        </Text>
      );
    })}
    <Text>
      <Text color="#888888">
        {" "}
        {" " + [...FILES].map((f) => ` ${f} `).join("")}
      </Text>
    </Text>
  </Box>
);
