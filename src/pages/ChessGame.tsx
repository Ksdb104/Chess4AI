import React, { useState, useEffect } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type SquareHandlerArgs } from "react-chessboard";
import { useStore } from "../store/useStore";
import { getNextMove } from "../lib/ai";
import { RotateCcw, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const ChessGame: React.FC = () => {
  const navigate = useNavigate();
  const { apiSettings } = useStore();
  const [game, setGame] = useState(new Chess());
  const [moveFrom, setMoveFrom] = useState("");
  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [fenHistory, setFenHistory] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [optionSquares, setOptionSquares] = useState<
    Record<string, React.CSSProperties>
  >({});
  const [nowpiece, setNowPiece] = useState("");

  // 比赛状态
  const isGameOver = game.isGameOver();
  const status = isGameOver
    ? game.isCheckmate()
      ? `Checkmate! ${game.turn() === "w" ? "Black" : "White"} wins`
      : "Draw"
    : playerColor && game.turn() === playerColor
    ? "Your Turn"
    : "AI Thinking...";

  // 初始化游戏
  const startGame = (color: "w" | "b") => {
    const newGame = new Chess();
    setGame(newGame);
    setPlayerColor(color);
    setMoveHistory([]);
    setFenHistory([]);
    setOptionSquares({});

    // 如果玩家选择黑棋，AI 先手
    if (color === "b") {
      // 触发 AI 移动效果
    }
  };

  // AI 移动效果
  useEffect(() => {
    if (!playerColor || isGameOver || isAiThinking) return;

    if (game.turn() !== playerColor) {
      const makeAiMove = async () => {
        setIsAiThinking(true);
        try {
          const fen = game.fen();
          const moveSan = await getNextMove(
            "chess",
            fen,
            moveHistory,
            apiSettings,
            game.turn()
          );

          safeMakeMove(moveSan);
        } catch (error) {
          console.error("AI failed to move", error);
          alert("AI failed to move. Check API settings.");
        } finally {
          setIsAiThinking(false);
        }
      };

      makeAiMove();
    }
  }, [game, playerColor, isGameOver, apiSettings]); // 依赖游戏状态

  const safeMakeMove = (
    move: string | { from: string; to: string; promotion?: string }
  ) => {
    try {
      const gameCopy = new Chess(game.fen());
      let result = null;

      try {
        result = gameCopy.move(move);
      } catch {
        // 如果移动失败，尝试升变为后 (如果是升变移动)
        if (typeof move === "object" && !move.promotion) {
          try {
            result = gameCopy.move({ ...move, promotion: "q" });
          } catch {
            // 仍然失败，非法移动
          }
        }
      }

      if (result) {
        setGame(gameCopy);
        setFenHistory((h) => [...h, game.fen()]);
        setMoveHistory((h) => [...h, result.san]);
        return true;
      }
    } catch (error) {
      console.warn("Invalid move", move, error);
    }
    return false;
  };

  // 获取格子的移动选项以显示合法移动
  function getMoveOptions(square: Square) {
    // 获取格子的移动
    const moves = game.moves({
      square,
      verbose: true,
    });

    // 如果没有移动，清除选项格子
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }

    // 创建新对象以存储选项格子
    const newSquares: Record<string, React.CSSProperties> = {};

    // 循环遍历移动并设置选项格子
    for (const move of moves) {
      newSquares[move.to] = {
        background:
          game.get(move.to) &&
          game.get(move.to)?.color !== game.get(square)?.color
            ? "radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)" // 捕获时的大圆圈
            : "radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)",
        // 移动时的小圆圈
        borderRadius: "50%",
      };
    }

    // 将点击移动的起始格子设置为黄色
    newSquares[square] = {
      background: "rgba(255, 255, 0, 0.4)",
    };

    // 设置选项格子
    setOptionSquares(newSquares);

    // 返回 true 表示有移动选项
    return true;
  }

  function onSquareClick({ square, piece }: SquareHandlerArgs) {
    if (piece) {
      setNowPiece(piece.pieceType.substring(0, 1));
    }

    // 点击了棋子以进行移动
    if (!moveFrom && piece) {
      // 获取格子的移动选项
      const hasMoveOptions = getMoveOptions(square as Square);

      // 如果有移动选项，设置 moveFrom 为该格子
      if (hasMoveOptions) {
        setMoveFrom(square);
      }

      // 提前返回
      return;
    }

    // 点击了目标格子，检查是否合法移动
    const moves = game.moves({
      square: moveFrom as Square,
      verbose: true,
    });
    const foundMove = moves.find((m) => m.from === moveFrom && m.to === square);

    // 非法移动
    if (!foundMove || (nowpiece && nowpiece != playerColor)) {
      // 检查是否点击了新棋子
      const hasMoveOptions = getMoveOptions(square as Square);

      // 如果是新棋子，设置 moveFrom，否则清除 moveFrom
      setMoveFrom(hasMoveOptions ? square : "");

      // 提前返回
      return;
    }

    // 正常移动
    try {
      safeMakeMove({
        from: moveFrom,
        to: square,
        promotion: "q",
      });
    } catch {
      // 如果无效，设置 moveFrom 并获取移动选项
      const hasMoveOptions = getMoveOptions(square as Square);

      // 如果是新棋子，设置 moveFrom
      if (hasMoveOptions) {
        setMoveFrom(square);
      }

      // 提前返回
      return;
    }

    // 清除 moveFrom 和 optionSquares
    setNowPiece("");
    setMoveFrom("");
    setOptionSquares({});
  }

  const handleUndo = () => {
    setFenHistory((h) => h.slice(0, -1));
    // 加载上一个状态
    if (fenHistory.length > 0) {
        game.load(fenHistory[fenHistory.length - 1]);
    } else {
        game.reset();
    }
    setMoveHistory((h) => h.slice(0, -1));
    setOptionSquares({});
  }

  // 设置棋盘选项
  const chessboardOptions = {
    position: game.fen(),
    onSquareClick: onSquareClick,
    boardOrientation: playerColor === "w" ? "white" : "black",
    squareStyles: optionSquares,
    areArrowsAllowed: true,
  };

  if (!playerColor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
        <h2 className="text-2xl font-bold">选边</h2>
        <div className="flex gap-4">
          <button
            onClick={() => startGame("w")}
            className="flex flex-col items-center p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-all w-[150px]"
          >
            <div className="text-4xl mb-2">♔</div>
            <span className="font-bold">白方</span>
            <span className="text-sm text-gray-500">先手</span>
          </button>
          <button
            onClick={() => startGame("b")}
            className="flex flex-col items-center p-6 bg-black text-white border-2 border-gray-800 rounded-lg hover:border-blue-500 transition-all w-[150px]"
          >
            <div className="text-4xl mb-2">♚</div>
            <span className="font-bold">黑方</span>
            <span className="text-sm text-gray-400">后手</span>
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

  return (
    <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
      <div className="flex-1">
        <div className="bg-white p-4 rounded-lg shadow-lg aspect-square">
          <Chessboard 
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            options={chessboardOptions}
           />
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
              onClick={() => handleUndo()}
              disabled={isGameOver || isAiThinking || moveHistory.length === 0}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              <RotateCcw size={16} /> 悔棋
            </button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-bold mb-2">棋谱</h4>
            <div className="h-64 overflow-y-auto text-sm font-mono bg-gray-50 p-2 rounded">
              <div className="grid grid-cols-2 gap-x-4">
                {moveHistory
                  .reduce<{ white: string; black: string; num: number }[]>(
                    (acc, move, i) => {
                      if (i % 2 === 0) {
                        acc.push({
                          white: move,
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
                      <div className="w-1/2 flex">
                        <div className="text-gray-500 text-center">
                          {row.num}.
                        </div>
                        <div className="flex justify-between w-full col-span-1">
                          <span>{row.white}</span>
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
