type Color = "w" | "b";

type FenPiece = {
  color: Color;
  type: string;
  row: number;
  col: number;
};

const RED_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

const PIECE_NAMES: Record<Color, Record<string, string>> = {
  w: { k: "帥", a: "仕", b: "相", n: "马", r: "车", c: "炮", p: "兵" },
  b: { k: "将", a: "士", b: "象", n: "馬", r: "車", c: "砲", p: "卒" },
};

function parseFen(fen: string): FenPiece[] {
  const pieces: FenPiece[] = [];
  const rows = fen.split(" ")[0].split("/");

  rows.forEach((rowText, row) => {
    let col = 0;
    for (const char of rowText) {
      if (/\d/.test(char)) {
        col += Number(char);
      } else {
        pieces.push({
          color: char === char.toUpperCase() ? "w" : "b",
          type: char.toLowerCase(),
          row,
          col,
        });
        col += 1;
      }
    }
  });

  return pieces;
}

function parseSquare(square: string) {
  return {
    col: square.charCodeAt(0) - "a".charCodeAt(0),
    row: 9 - Number(square[1]),
  };
}

function fileNumber(color: Color, col: number) {
  const number = color === "w" ? 9 - col : col + 1;
  return color === "w" ? RED_NUMERALS[number - 1] : String(number);
}

function stepNumber(color: Color, steps: number) {
  return color === "w" ? RED_NUMERALS[steps - 1] : String(steps);
}

function disambiguatedName(piece: FenPiece, pieces: FenPiece[]) {
  const sameFile = pieces
    .filter(
      (candidate) =>
        candidate.color === piece.color &&
        candidate.type === piece.type &&
        candidate.col === piece.col,
    )
    .sort((left, right) =>
      piece.color === "w" ? left.row - right.row : right.row - left.row,
    );

  const pieceName = PIECE_NAMES[piece.color][piece.type] ?? piece.type;
  if (sameFile.length < 2) {
    return `${pieceName}${fileNumber(piece.color, piece.col)}`;
  }

  const index = sameFile.findIndex(
    (candidate) => candidate.row === piece.row && candidate.col === piece.col,
  );
  const prefixes =
    sameFile.length === 2
      ? ["前", "后"]
      : sameFile.length === 3
        ? ["前", "中", "后"]
        : sameFile.map((_, position) =>
            position === 0
              ? "前"
              : position === sameFile.length - 1
                ? "后"
                : stepNumber(piece.color, position + 1),
          );

  return `${prefixes[index] ?? ""}${pieceName}`;
}

export function ucciToChinese(fen: string, ucci: string): string {
  if (!/^[a-i][0-9][a-i][0-9]$/.test(ucci)) return ucci;

  const pieces = parseFen(fen);
  const from = parseSquare(ucci.slice(0, 2));
  const to = parseSquare(ucci.slice(2, 4));
  const piece = pieces.find(
    (candidate) => candidate.row === from.row && candidate.col === from.col,
  );
  if (!piece) return ucci;

  const name = disambiguatedName(piece, pieces);
  if (from.row === to.row) {
    return `${name}平${fileNumber(piece.color, to.col)}`;
  }

  const forward = piece.color === "w" ? to.row < from.row : to.row > from.row;
  const action = forward ? "进" : "退";
  const usesDestinationFile = ["n", "b", "a"].includes(piece.type);
  const destination = usesDestinationFile
    ? fileNumber(piece.color, to.col)
    : stepNumber(piece.color, Math.abs(to.row - from.row));

  return `${name}${action}${destination}`;
}

export function formatXiangqiHistory(
  fenHistory: string[],
  moveHistory: string[],
): string[] {
  return moveHistory.map((move, index) =>
    fenHistory[index] ? ucciToChinese(fenHistory[index], move) : move,
  );
}

export function formatXiangqiVariation(fen: string, variation: string[]): string {
  const rows = fen.split(" ")[0].split("/").map((rowText) => {
    const row: Array<string | null> = [];
    for (const char of rowText) {
      if (/\d/.test(char)) row.push(...Array<string | null>(Number(char)).fill(null));
      else row.push(char);
    }
    return row;
  });
  let turn = fen.split(" ")[1] || "w";
  const formatted: string[] = [];

  for (const move of variation.slice(0, 8)) {
    const currentFen = `${rows
      .map((row) => {
        let text = "";
        let empty = 0;
        for (const piece of row) {
          if (!piece) empty += 1;
          else {
            if (empty) text += empty;
            text += piece;
            empty = 0;
          }
        }
        return text + (empty || "");
      })
      .join("/")} ${turn} - - 0 1`;
    formatted.push(ucciToChinese(currentFen, move));

    if (!/^[a-i][0-9][a-i][0-9]$/.test(move)) break;
    const from = parseSquare(move.slice(0, 2));
    const to = parseSquare(move.slice(2, 4));
    rows[to.row][to.col] = rows[from.row][from.col];
    rows[from.row][from.col] = null;
    turn = turn === "w" ? "b" : "w";
  }

  return formatted.join(" ");
}