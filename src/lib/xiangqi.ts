// 简单的中国象棋逻辑
// FEN 处理和走法生成

export type Color = 'w' | 'b'; // w=红方 (FEN中通常w表示红方), b=黑方
export type PieceType = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p';
export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[][]; // 10 行 (排), 9 列 (路)

const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

export class Xiangqi {
  board: Board;
  turn: Color;
  history: string[] = [];
  moveHistory: string[] = []; // 存储 UCCI 走法，如 "h2e2"

  constructor(fen: string = START_FEN) {
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));
    this.turn = 'w';
    this.load(fen);
    this.moveHistory = [];
  }

  load(fen: string) {
    // 加载前清空棋盘
    this.board = Array(10).fill(null).map(() => Array(9).fill(null));

    const tokens = fen.split(' ');
    const position = tokens[0];
    this.turn = tokens[1] as Color;
    
    let row = 0;
    let col = 0;

    for (let i = 0; i < position.length; i++) {
      const char = position[i];
      if (char === '/') {
        row++;
        col = 0;
      } else if (/\d/.test(char)) {
        col += parseInt(char);
      } else {
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase() as PieceType;
        // 如有需要映射 FEN 字符到类型 (象用b还是e? 通常是 b/n/r/c/p/k/a)
        // 标准: r=车, n=马, b=象/相, a=士/仕, k=帅/将, c=炮, p=兵/卒
        this.board[row][col] = { type, color };
        col++;
      }
    }
  }

  fen(): string {
    let result = "";
    for (let row = 0; row < 10; row++) {
      let empty = 0;
      for (let col = 0; col < 9; col++) {
        const piece = this.board[row][col];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) {
            result += empty;
            empty = 0;
          }
          const char = piece.type;
          result += piece.color === 'w' ? char.toUpperCase() : char;
        }
      }
      if (empty > 0) result += empty;
      if (row < 9) result += "/";
    }
    return `${result} ${this.turn} - - 0 1`;
  }

  get(row: number, col: number): Piece | null {
    if (row < 0 || row > 9 || col < 0 || col > 8) return null;
    return this.board[row][col];
  }

  move(move: { from: { r: number; c: number }; to: { r: number; c: number } }): boolean {
    const p = this.get(move.from.r, move.from.c);
    if (!p || p.color !== this.turn) return false;

    // 检查合法性 (简化: 仅检查是否在伪合法走法中)
    const validMoves = this.moves({ row: move.from.r, col: move.from.c });
    const isPseudoLegal = validMoves.some(m => m.r === move.to.r && m.c === move.to.c);
    
    if (!isPseudoLegal) return false;

    // 待办: 检查移动后是否导致被将军 (严格规则)
    // 对于 MVP，允许伪合法移动，但如果容易的话尽量警告或防止自杀。
    // 为了降低复杂度，暂时跳过严格的自杀检测，
    // 但 AI 通常不会走非法棋。

    this.performMove(move);
    return true;
  }
  
  // 规则验证
  moves(options?: { row: number, col: number }): { r: number, c: number }[] {
    const moves: { r: number, c: number }[] = [];
    // 如果提供了选项，则生成该棋子的走法。
    // 否则生成所有走法。
    
    if (options) {
      const { row, col } = options;
      const piece = this.get(row, col);
      if (!piece || piece.color !== this.turn) return [];

      const add = (r: number, c: number) => {
        if (r >= 0 && r < 10 && c >= 0 && c < 9) {
          const target = this.get(r, c);
          if (!target || target.color !== piece.color) {
            // 模拟移动以检查飞将（将帅对脸）
            this.board[r][c] = piece;
            this.board[options.row][options.col] = null;
            
            const isIllegal = this.generalsFaceEachOther(this.board);
            
            // 撤销移动
            this.board[options.row][options.col] = piece;
            this.board[r][c] = target;

            if (!isIllegal) {
              moves.push({ r, c });
            }
          }
        }
      };

      // 每个棋子的逻辑
      // 帅/将
      if (piece.type === 'k') {
        // 九宫格: 
        // 红方: r7-9, c3-5
        // 黑方: r0-2, c3-5
        const isRed = piece.color === 'w';
        const rMin = isRed ? 7 : 0;
        const rMax = isRed ? 9 : 2;
        const cMin = 3;
        const cMax = 5;

        [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= rMin && nr <= rMax && nc >= cMin && nc <= cMax) {
                add(nr, nc);
            }
        });
        
        // 飞将? (将帅对脸) - 稍后在合法走法验证中检查 (过滤掉导致被将军的走法)
      }
      
      // 士/仕
      else if (piece.type === 'a') {
        const isRed = piece.color === 'w';
        const rMin = isRed ? 7 : 0;
        const rMax = isRed ? 9 : 2;
        const cMin = 3;
        const cMax = 5;
        
        [[1,1], [1,-1], [-1,1], [-1,-1]].forEach(([dr, dc]) => {
           const nr = row + dr;
           const nc = col + dc;
           if (nr >= rMin && nr <= rMax && nc >= cMin && nc <= cMax) {
               add(nr, nc);
           }
        });
      }

      // 象/相
      else if (piece.type === 'b') {
          // 不能过河 (红方: r5-9, 黑方: r0-4)
          // 走田字 (2格对角), 象眼必须为空
          const isRed = piece.color === 'w';
          const rMin = isRed ? 5 : 0;
          const rMax = isRed ? 9 : 4;

          [[2,2], [2,-2], [-2,2], [-2,-2]].forEach(([dr, dc]) => {
              const nr = row + dr;
              const nc = col + dc;
              const er = row + dr/2; // 象眼行
              const ec = col + dc/2; // 象眼列
              
              if (nr >= rMin && nr <= rMax && nc >= 0 && nc < 9) {
                  if (!this.get(er, ec)) { // 塞象眼?
                      add(nr, nc);
                  }
              }
          });
      }

      // 马
      else if (piece.type === 'n') {
          // 日字型, 蹩马腿检查
          const jumps = [
              {dr: -2, dc: -1, br: -1, bc: 0}, {dr: -2, dc: 1, br: -1, bc: 0},
              {dr: 2, dc: -1, br: 1, bc: 0}, {dr: 2, dc: 1, br: 1, bc: 0},
              {dr: -1, dc: -2, br: 0, bc: -1}, {dr: 1, dc: -2, br: 0, bc: -1},
              {dr: -1, dc: 2, br: 0, bc: 1}, {dr: 1, dc: 2, br: 0, bc: 1}
          ];
          jumps.forEach(j => {
              const nr = row + j.dr;
              const nc = col + j.dc;
              const br = row + j.br;
              const bc = col + j.bc;
              if (nr >= 0 && nr < 10 && nc >= 0 && nc < 9) {
                  if (!this.get(br, bc)) { // 未被蹩腿
                      add(nr, nc);
                  }
              }
          });
      }

      // 车
      else if (piece.type === 'r') {
          [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
              let r = row + dr;
              let c = col + dc;
              while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                  const p = this.get(r, c);
                  if (!p) {
                      add(r, c);
                  } else {
                      if (p.color !== piece.color) add(r, c);
                      break;
                  }
                  r += dr;
                  c += dc;
              }
          });
      }

      // 炮
      else if (piece.type === 'c') {
          [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
              let r = row + dr;
              let c = col + dc;
              let jumped = false;
              while (r >= 0 && r < 10 && c >= 0 && c < 9) {
                  const p = this.get(r, c);
                  if (!jumped) {
                      if (!p) {
                          add(r, c);
                      } else {
                          jumped = true;
                      }
                  } else {
                      if (p) {
                          if (p.color !== piece.color) add(r, c);
                          break;
                      }
                  }
                  r += dr;
                  c += dc;
              }
          });
      }

      // 兵/卒
      else if (piece.type === 'p') {
          const isRed = piece.color === 'w';
          const dr = isRed ? -1 : 1; // 红方向上 (行号减小), 黑方向下
          // 前进
          const fr = row + dr;
          if (fr >= 0 && fr < 10) add(fr, col);
          
          // 横走 (如果过河)
          // 河界在 r4 和 r5 之间。
          // 红方行 <= 4 为过河。黑方行 >= 5 为过河。
          const crossed = isRed ? row <= 4 : row >= 5;
          if (crossed) {
              add(row, col - 1);
              add(row, col + 1);
          }
      }
    }
    
    return moves;
  }

  performMove(move: { from: {r:number, c:number}, to: {r:number, c:number} }) {
      const p = this.get(move.from.r, move.from.c);
      
      // 保存状态以供悔棋 (快照或移动信息)
      // 存储 FEN 对于简单的悔棋更容易
      this.history.push(this.fen());

      // 记录 UCCI 走法
      const fCol = String.fromCharCode('a'.charCodeAt(0) + move.from.c);
      const fRow = 9 - move.from.r;
      const tCol = String.fromCharCode('a'.charCodeAt(0) + move.to.c);
      const tRow = 9 - move.to.r;
      this.moveHistory.push(`${fCol}${fRow}${tCol}${tRow}`);

      this.board[move.to.r][move.to.c] = p;
      this.board[move.from.r][move.from.c] = null;
      this.turn = this.turn === 'w' ? 'b' : 'w';
  }

  undo() {
    if (this.history.length === 0) return;
    const prevFen = this.history.pop();
    this.moveHistory.pop(); // 从记录中移除最后一步
    if (prevFen) {
        this.load(prevFen);
        // 历史记录已弹出，但 load() 重置了回合。
        // 我们需要正确恢复历史状态。
        // 由于 load() 不触碰 history 数组 (属于类实例)，所以没问题。
        // 但如果我们回退了，现在就处于上一个状态。
    }
  }

  isGameOver(): boolean {
      // 简单检查: 帅/将是否丢失?
      let redKing = false;
      let blackKing = false;
      for(let r=0; r<10; r++) {
          for(let c=0; c<9; c++) {
              const p = this.board[r][c];
              if(p && p.type === 'k') {
                  if(p.color === 'w') redKing = true;
                  else blackKing = true;
              }
          }
      }
      return !redKing || !blackKing;
  }

  // 检查将帅是否直接对脸
  generalsFaceEachOther(boardState: Board): boolean {
    let redGenPos: {r: number, c: number} | null = null;
    let blackGenPos: {r: number, c: number} | null = null;

    // 查找将帅
    for(let r=0; r<10; r++) {
        for(let c=3; c<=5; c++) { // 将帅总是在 3-5 列
            const p = boardState[r][c];
            if (p && p.type === 'k') {
                if (p.color === 'w') redGenPos = {r, c};
                else blackGenPos = {r, c};
            }
        }
    }

    if (!redGenPos || !blackGenPos) return false; // 正常游戏中不应发生
    if (redGenPos.c !== blackGenPos.c) return false; // 不在同一列

    // 检查中间的棋子
    const col = redGenPos.c;
    const minR = Math.min(redGenPos.r, blackGenPos.r);
    const maxR = Math.max(redGenPos.r, blackGenPos.r);

    for (let r = minR + 1; r < maxR; r++) {
        if (boardState[r][col]) return false; // 发现中间有棋子
    }

    return true; // 对脸
  }
}
