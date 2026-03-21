// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import React, { useEffect, useRef, useState } from "react";
import { Box, Text } from "ink";
import { UI_COLORS } from "@/lib";

const DVD_LABEL = "board detached";

type DvdBounceProps = {
  width: number;
  height: number;
};

export const DvdBounce = ({
  width,
  height,
}: DvdBounceProps): React.JSX.Element => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const vel = useRef({ dx: 1, dy: 1 });

  const labelLen = DVD_LABEL.length;
  const maxX = Math.max(0, width - labelLen);
  const maxY = Math.max(0, height - 1);

  useEffect(() => {
    const id = setInterval(() => {
      setPos((prev) => {
        let nx = prev.x + vel.current.dx;
        let ny = prev.y + vel.current.dy;
        if (nx <= 0 || nx >= maxX) vel.current.dx *= -1;
        if (ny <= 0 || ny >= maxY) vel.current.dy *= -1;
        nx = Math.max(0, Math.min(maxX, nx));
        ny = Math.max(0, Math.min(maxY, ny));
        return { x: nx, y: ny };
      });
    }, 350);

    return () => clearInterval(id);
  }, [maxX, maxY]);

  return (
    <Box width={width} height={height} flexDirection="column">
      {Array.from({ length: height }, (_, row) => (
        <Box key={row} width={width}>
          {row === pos.y ? (
            <Text>
              {" ".repeat(pos.x)}
              <Text color={UI_COLORS.muted}>{DVD_LABEL}</Text>
            </Text>
          ) : (
            <Text> </Text>
          )}
        </Box>
      ))}
    </Box>
  );
};
