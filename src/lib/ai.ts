import axios from "axios";
import { type ApiSettings } from "../store/useStore";

export const getNextMove = async (
  gameType: "chess" | "xiangqi",
  fen: string,
  history: string[],
  settings: ApiSettings,
  playerColor: string
): Promise<string> => {
  const { baseUrl, apiKey, model } = settings;
  if (!baseUrl || !apiKey || !model) {
    throw new Error("API settings are incomplete");
  }

  //   `You are a chess engine. The current FEN is "${fen}". The game history is: ${history.join(' ')}.
  //        It is ${playerColor === 'w' ? 'white' : 'black'}'s turn.
  //        Analyze the position and output the best next move in Standard Algebraic Notation (SAN).
  //        Output ONLY the move, no explanation. Do not number the move.`

  // `You are a Chinese Chess (Xiangqi) master. The current FEN is "${fen}". The game history is: ${history.join(' ')}.
  //        It is ${playerColor === 'w' ? 'Red' : 'Black'}'s turn.
  //        Analyze the position and output the best next move in UCCI or standard Chinese Chess notation (e.g. 炮二平五 or h2e2).
  //        Prefer UCCI (e.g. h2e2) if possible as it is easier to parse.
  //        Output ONLY the move, no explanation.`

  const prompt =
    gameType === "chess"
      ? `角色：你是一名严格遵守FIDE规则的国际象棋大师，只使用标准代数记谱法(SAN)输出走法。

        SAN规则必须遵守：
        1. K=王，Q=后，R=车，B=象，N=马，兵无缩写
        2. 移动：棋子+到达格（如Nf3）；兵仅写到达格（如e4）
        3. 吃子：用x表示（如Bxe5，exd5）
        4. 歧义：同类型棋子加出发线/线+列（如Rae1）
        5. 特殊：O-O=王翼易位，O-O-O=后翼易位，升变用=（如e8=Q）
        6. 结束：+=将军，#=将死

        当前棋局：
        FEN: ${fen}
        历史棋谱: ${history.join(" ")}
        走子方: ${playerColor === "w" ? "白方" : "黑方"}

        指令：生成下一步最优合法走法，仅输出纯SAN字符串，无任何额外内容。`
      : `角色：你是一名精通中国象棋UCCI规则的专业对弈助手，具备精准的UCCI棋谱解析能力和合法走步生成能力。

核心规则约束（必须严格遵守UCCI规则）：
1.  棋盘坐标规范：UCCI棋盘横向为a-i（按红方视角从左至右，对应中国象棋第1-9路），纵向为0-9（以红方视角为基准：己方底线为0，对方底线为9）。
2.  走子格式规范：UCCI走子必须采用「源坐标+目标坐标」的纯字符格式，无额外冗余信息，吃子无需额外标注（目标坐标有对方棋子即判定为吃子）。
3.  棋子走法约束（UCCI标准）：
   - 车：横向/纵向任意格数移动，无遮挡时合法；
   - 马：走“日”字（横向2格纵向1格，或横向1格纵向2格），无绊马腿（移动方向相邻格无棋子）时合法；
   - 炮：横向/纵向任意格数移动，无遮挡时合法；吃子时必须跳过恰好1枚任意方棋子（炮架）；
   - 兵/卒：未过河（红方<5线、黑方>4线）时仅能向前走1格；过河后可横向/向前走1格，不可后退；
   - 象/相：红方走“田”字（仅限己方半场：红方≤4线、黑方≥6线），无塞象眼（田字中心有棋子）时合法；
   - 士/仕：仅能在九宫格内走“斜日”（横向1格纵向1格），不可出九宫；
   - 将/帅：仅能在九宫格内横向/纵向走1格，不可主动送吃，双方将/帅不可直接对面（无遮挡时纵向同路相邻非法）。
4.  特殊规则：必须规避长将（同一方连续3次及以上重复将军）、长捉（同一方连续3次及以上重复捕捉无保护棋子）等UCCI违规走法；当前行棋方若被将军，必须优先生成应将走步（解除将军状态）。

            当前棋局：
        UCCI FEN: ${fen}
        历史棋谱: ${history.join(" ")}
        走子方: ${playerColor === "w" ? "红方" : "黑方"}
        
        指令：生成下一步最优合法走法，仅输出纯UCCI字符串，无任何额外内容。`;
  try {
    const url = baseUrl.replace(/\/+$/, "");
    const response = await axios.post(
      `${url}/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that plays board games.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1, // 本意是降低不确定性，但是使用中觉得还是不妥
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();
    // 如果响应包含额外文本，请进行清理
    const move = content.split(/\s+/)[0].replace(/[.,]/g, "");
    return move;
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};
