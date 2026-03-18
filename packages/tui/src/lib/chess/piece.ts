export type PieceKind = "p" | "n" | "b" | "r" | "q" | "k";
export type PieceColor = "w" | "b";
export type PieceCode = PieceKind | Uppercase<PieceKind>;

export type PieceTemplate = {
  isSliding: boolean;
  deltas: [number, number][];
  power: number;
  glyph: Record<PieceColor, string>;
};

export type PieceDefinition = {
  code: PieceCode;
  kind: PieceKind;
  color: PieceColor;
  isSliding: boolean;
  deltas: [number, number][];
  power: number;
  glyph: string;
};

export const PIECE_TPLS: Record<PieceKind, PieceTemplate> = {
  n: {
    isSliding: false,
    power: 3,
    deltas: [
      [1, 2], [2, 1], [-1, 2], [-2, 1],
      [1, -2], [2, -1], [-1, -2], [-2, -1],
    ],
    glyph: { w: "♘", b: "♞" },
  },
  b: {
    isSliding: true,
    power: 3,
    deltas: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
    glyph: { w: "♗", b: "♝" },
  },
  r: {
    isSliding: true,
    power: 5,
    deltas: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    glyph: { w: "♖", b: "♜" },
  },
  q: {
    isSliding: true,
    power: 9,
    deltas: [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ],
    glyph: { w: "♕", b: "♛" },
  },
  k: {
    isSliding: false,
    power: Number.POSITIVE_INFINITY,
    deltas: [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ],
    glyph: { w: "♔", b: "♚" },
  },
  p: {
    isSliding: false,
    power: 1,
    deltas: [],
    glyph: { w: "♙", b: "♟" },
  },
};

const KINDS: PieceKind[] = ["p", "n", "b", "r", "q", "k"];

export const isPieceKind = (value: string): value is PieceKind =>
  value === "p" || value === "n" || value === "b" || value === "r" || value === "q" || value === "k";

const byCode = {} as Record<PieceCode, PieceDefinition>;
for (const kind of KINDS) {
  const tpl = PIECE_TPLS[kind];
  const upperCode = kind.toUpperCase() as Uppercase<PieceKind>;

  byCode[kind] = {
    code: kind,
    kind,
    color: "b",
    isSliding: tpl.isSliding,
    deltas: tpl.deltas,
    power: tpl.power,
    glyph: tpl.glyph.b,
  };

  byCode[upperCode] = {
    code: upperCode,
    kind,
    color: "w",
    isSliding: tpl.isSliding,
    deltas: tpl.deltas,
    power: tpl.power,
    glyph: tpl.glyph.w,
  };
}

export const PIECES_BY_CODE: Record<PieceCode, PieceDefinition> = Object.freeze(byCode);

export const PIECE_POWER = Object.freeze({
  p: PIECE_TPLS.p.power,
  n: PIECE_TPLS.n.power,
  b: PIECE_TPLS.b.power,
  r: PIECE_TPLS.r.power,
  q: PIECE_TPLS.q.power,
  k: PIECE_TPLS.k.power,
});

export const getPieceGlyph = (kind: PieceKind, color: PieceColor): string => {
  const code = color === "w" ? (kind.toUpperCase() as PieceCode) : kind;
  return PIECES_BY_CODE[code].glyph;
};
