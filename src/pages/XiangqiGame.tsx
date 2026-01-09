import React, { useState, useEffect } from "react";
import { Xiangqi, type PieceType } from "../lib/xiangqi";
import { useStore } from "../store/useStore";
import { getNextMove } from "../lib/ai";
import { RotateCcw, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CELL_SIZE = 50;
const BOARD_PADDING = 30;
const BOARD_WIDTH = CELL_SIZE * 8 + BOARD_PADDING * 2;
const BOARD_HEIGHT = CELL_SIZE * 9 + BOARD_PADDING * 2;

const PIECE_CHARS: Record<string, Record<PieceType, string>> = {
  w: { k: "帥", a: "仕", b: "相", n: "马", r: "車", c: "炮", p: "兵" },
  b: { k: "将", a: "士", b: "象", n: "馬", r: "车", c: "砲", p: "卒" },
};

export const XiangqiGame: React.FC = () => {
  const navigate = useNavigate();
  const { apiSettings } = useStore();
  const [game, setGame] = useState(new Xiangqi());
  const [boardState, setBoardState] = useState(game.board); // 触发重渲染
  const [turn, setTurn] = useState(game.turn);
  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);
  const [selectedPos, setSelectedPos] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [validMoves, setValidMoves] = useState<{ r: number; c: number }[]>([]);
  const [lastMove, setLastMove] = useState<{
    from: { r: number; c: number };
    to: { r: number; c: number };
  } | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // 强制更新包装器
  const updateGame = () => {
    setBoardState([...game.board.map((row) => [...row])]);
    setTurn(game.turn);
  };

  const isGameOver = game.isGameOver();
  const status = isGameOver
    ? `Game Over`
    : playerColor && turn === playerColor
    ? "Your Turn"
    : "AI Thinking...";

  // 开始游戏
  const startGame = (color: "w" | "b") => {
    const newGame = new Xiangqi();
    setGame(newGame);
    setBoardState(newGame.board);
    setTurn(newGame.turn);
    setPlayerColor(color);
    setLastMove(null);
    setSelectedPos(null);
    setValidMoves([]);
  };

  // 辅助函数: 坐标转换 (UCCI <-> 内部坐标)
  // 内部坐标: r0 (顶部) -> r9 (底部). c0 (左) -> c8 (右).
  // UCCI: a0 (左下) -> i9 (右上).
  // 因此: myC = ucciFileIndex. myR = 9 - ucciRank.
  const fromUCCI = (ucci: string) => {
    const c = ucci.charCodeAt(0) - "a".charCodeAt(0);
    const r = 9 - parseInt(ucci[1]);
    return { r, c };
  };

  // AI 移动效果
  useEffect(() => {
    if (!playerColor || isGameOver || isAiThinking) return;

    if (turn !== playerColor) {
      const makeAiMove = async () => {
        setIsAiThinking(true);
        try {
          const fen = game.fen();
          const history = game.moveHistory;

          const moveStr = await getNextMove(
            "xiangqi",
            fen,
            history,
            apiSettings,
            turn
          );

          // 解析移动。
          // 如果是 UCCI (如 h2e2)，解析它。
          // 如果是纯坐标 (如 7174 -> r7c1 到 r7c4? 不，通常是 UCCI)
          // 一些引擎返回4位数字: csrc (列起, 行起, 列终, 行终).
          // 假设是 UCCI (如 h2e2 或 h0g2)

          let from, to;
          if (moveStr.length === 4) {
            // 检查是数字还是字符
            // 如果 "7174" -> 通常是索引。但也可能是 ucci "h2e2"。
            const isUCCI = /^[a-i]\d[a-i]\d$/.test(moveStr);
            if (isUCCI) {
              from = fromUCCI(moveStr.substring(0, 2));
              to = fromUCCI(moveStr.substring(2, 4));
            } else {
              // 尝试解析中文记谱? 很难。
              // 后备: 如果是4位数字，尝试解释为原始坐标?
              console.warn("Unknown move format:", moveStr);
              return;
            }
          } else {
            console.warn("Invalid move string length:", moveStr);
            return;
          }

          if (from && to) {
            const success = game.move({ from, to });
            if (success) {
              setLastMove({ from, to });
              updateGame();
            } else {
              console.warn("AI attempted illegal move:", moveStr);
            }
          }
        } catch (error) {
          console.error("AI Error", error);
        } finally {
          setIsAiThinking(false);
        }
      };

      makeAiMove();
    }
  }, [turn, playerColor, isGameOver, apiSettings]);

  const handleSquareClick = (r: number, c: number) => {
    if (turn !== playerColor || isAiThinking || isGameOver) return;

    const piece = game.get(r, c);

    // 如果选择了己方棋子
    if (piece && piece.color === playerColor) {
      setSelectedPos({ r, c });
      setValidMoves(game.moves({ row: r, col: c }));
      return;
    }

    // 如果尝试移动到某个格子
    if (selectedPos) {
      // 检查是否合法移动
      const isLegal = validMoves.some((m) => m.r === r && m.c === c);
      if (isLegal) {
        const success = game.move({ from: selectedPos, to: { r, c } });
        if (success) {
          setLastMove({ from: selectedPos, to: { r, c } });
          setSelectedPos(null);
          setValidMoves([]);
          updateGame();
        }
      } else {
        // 点击了空位或敌方但非法 -> 取消选择
        setSelectedPos(null);
        setValidMoves([]);
      }
    }
  };

  const handleUndo = () => {
    game.undo(); // 撤销 AI
    game.undo(); // 撤销玩家
    setLastMove(null); // 清除高亮或从历史恢复 (复杂)
    setSelectedPos(null);
    setValidMoves([]);
    updateGame();
  };

  if (!playerColor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        <h2 className="text-2xl font-bold">选边</h2>
        <div className="flex gap-4">
          <button
            onClick={() => startGame("w")}
            className="flex flex-col items-center p-6 bg-red-50 border-2 border-red-200 rounded-lg hover:border-red-500 transition-all text-red-700"
          >
            <div className="text-4xl mb-2">帥</div>
            <span className="font-bold">红棋 (先手)</span>
          </button>
          <button
            onClick={() => startGame("b")}
            className="flex flex-col items-center p-6 bg-gray-50 border-2 border-gray-200 rounded-lg hover:border-black transition-all text-black"
          >
            <div className="text-4xl mb-2">将</div>
            <span className="font-bold">黑棋 (后手)</span>
          </button>
        </div>
        <button
          onClick={() => navigate("/")}
          className="text-gray-500 underline"
        >
          返回首页
        </button>
      </div>
    );
  }

  // 计算坐标
  const getX = (c: number) => BOARD_PADDING + c * CELL_SIZE;
  const getY = (r: number) => BOARD_PADDING + r * CELL_SIZE;

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto px-4">
      <div className="flex-1 flex justify-center w-full">
        <div
          className="relative w-full max-w-[85%]"
          style={{
            aspectRatio: `${BOARD_WIDTH}/${BOARD_HEIGHT}`,
            transform: playerColor === "b" ? "rotate(180deg)" : "none",
          }}
        >
          {/* SVG 棋盘 */}
          <svg
            viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
            className="w-full h-full shadow-xl bg-[#DEB887]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 网格线 */}
            {Array.from({ length: 10 }).map((_, i) => (
              <line
                key={`h${i}`}
                x1={getX(0)}
                y1={getY(i)}
                x2={getX(8)}
                y2={getY(i)}
                stroke="black"
                strokeWidth="1"
              />
            ))}
            {/* 垂直线 (上半部分) */}
            {Array.from({ length: 9 }).map((_, i) => (
              <React.Fragment key={`v${i}`}>
                <line
                  x1={getX(i)} y1={getY(0)}
                  x2={getX(i)} y2={getY(4)}
                  stroke="black" strokeWidth="1"
                />
                <line
                  x1={getX(i)} y1={getY(5)}
                  x2={getX(i)} y2={getY(9)}
                  stroke="black" strokeWidth="1"
                />
              </React.Fragment>
            ))}
            {/* 左右边界 */}
            <line
              x1={getX(0)}
              y1={getY(4)}
              x2={getX(0)}
              y2={getY(5)}
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1={getX(8)}
              y1={getY(4)}
              x2={getX(8)}
              y2={getY(5)}
              stroke="black"
              strokeWidth="1"
            />

            {/* 九宫格斜线 */}
            <line
              x1={getX(3)}
              y1={getY(0)}
              x2={getX(5)}
              y2={getY(2)}
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1={getX(5)}
              y1={getY(0)}
              x2={getX(3)}
              y2={getY(2)}
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1={getX(3)}
              y1={getY(9)}
              x2={getX(5)}
              y2={getY(7)}
              stroke="black"
              strokeWidth="1"
            />
            <line
              x1={getX(5)}
              y1={getY(9)}
              x2={getX(3)}
              y2={getY(7)}
              stroke="black"
              strokeWidth="1"
            />

            {/* 选中高亮 */}
            {selectedPos && (
              <rect
                x={getX(selectedPos.c) - CELL_SIZE / 2}
                y={getY(selectedPos.r) - CELL_SIZE / 2}
                width={CELL_SIZE}
                height={CELL_SIZE}
                fill="rgba(59, 130, 246, 0.3)"
              />
            )}

            {/* 最后一步高亮 */}
            {lastMove && (
              <>
                <rect
                  x={getX(lastMove.from.c) - CELL_SIZE / 2}
                  y={getY(lastMove.from.r) - CELL_SIZE / 2}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill="rgba(250, 204, 21, 0.3)"
                />
                <rect
                  x={getX(lastMove.to.c) - CELL_SIZE / 2}
                  y={getY(lastMove.to.r) - CELL_SIZE / 2}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill="rgba(250, 204, 21, 0.3)"
                />
              </>
            )}

            {/* 合法移动高亮 */}
            {validMoves.map((m, i) => (
              <circle
                key={`valid-${i}`}
                cx={getX(m.c)}
                cy={getY(m.r)}
                r={8}
                fill="rgba(34, 197, 94, 0.5)"
              />
            ))}

            {/* 棋子 */}
            {boardState.map((row, r) =>
              row.map((piece, c) => {
                if (!piece) return null;
                return (
                  <g
                    key={`${r}-${c}`}
                    onClick={() => handleSquareClick(r, c)}
                    style={{ cursor: "pointer" }}
                    transform={
                      playerColor === "b"
                        ? `rotate(180, ${getX(c)}, ${getY(r)})`
                        : undefined
                    }
                  >
                    <circle
                      cx={getX(c)}
                      cy={getY(r)}
                      r={CELL_SIZE / 2 - 2}
                      fill="#FDF5E6"
                      stroke={piece.color === "w" ? "#CC0000" : "#000000"}
                      strokeWidth="2"
                    />
                    <text
                      x={getX(c)}
                      y={getY(r)}
                      dy="0.35em"
                      textAnchor="middle"
                      fontSize="24"
                      fontWeight="bold"
                      fill={piece.color === "w" ? "#CC0000" : "#000000"}
                      style={{ fontFamily: "KaiTi, serif" }}
                    >
                      {PIECE_CHARS[piece.color][piece.type]}
                    </text>
                  </g>
                );
              })
            )}

            {/* 空交叉点的点击处理 */}
            {Array.from({ length: 10 }).map((_, r) =>
              Array.from({ length: 9 }).map((_, c) => {
                if (boardState[r][c]) return null;
                return (
                  <circle
                    key={`empty-${r}-${c}`}
                    cx={getX(c)}
                    cy={getY(r)}
                    r={CELL_SIZE / 2}
                    fill="transparent"
                    onClick={() => handleSquareClick(r, c)}
                    style={{ cursor: "pointer" }}
                  />
                );
              })
            )}
          </svg>
        </div>
      </div>

      <div className="md:w-80 flex flex-col gap-4">
        <div className="bg-white p-4 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">比赛状态</h3>
            <button
              onClick={() => navigate("/")}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft size={20} />
            </button>
          </div>

          <div className="mb-4">
            <div
              className={`text-lg font-semibold ${
                isGameOver ? "text-red-500" : "text-blue-600"
              }`}
            >
              {status}
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleUndo}
              disabled={isGameOver || isAiThinking || game.history.length < 2}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <RotateCcw size={16} /> 悔棋
            </button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-bold mb-2">棋谱 (UCCI)</h4>
            <div className="h-64 overflow-y-auto text-sm font-mono bg-gray-50 p-2 rounded">
              <div className="grid grid-cols-2 gap-x-4">
                {game.moveHistory
                  .reduce<{ red: string; black: string; num: number }[]>(
                    (acc, move, i) => {
                      if (i % 2 === 0) {
                        acc.push({
                          red: move,
                          black: "",
                          num: Math.floor(i / 2) + 1,
                        });
                      } else {
                        acc[acc.length - 1].black = move;
                      }
                      return acc;
                    },
                    []
                  )
                  .map((row) => (
                    <React.Fragment key={row.num}>
                      <div className="flex pl-2">
                        <div className="text-gray-500 text-center w-6">
                          {row.num}.
                        </div>
                        <div className="flex justify-between w-full col-span-1">
                          <span>{row.red}</span>
                          <span>{row.black}</span>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
