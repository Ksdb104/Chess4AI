import type { ApiSettings, EngineDifficulty } from "../store/useStore";

export type GameType = "chess" | "xiangqi";

export type EngineEvaluation = {
  type: "cp" | "mate";
  value: number;
  perspective: "sideToMove";
};

export type EngineCandidate = {
  depth: number;
  multiPv: number;
  evaluation: EngineEvaluation;
  move: string;
  variation: string[];
};

export type EngineAnalysis = {
  engine: string;
  bestMove: string;
  depth: number;
  evaluation: EngineEvaluation | null;
  principalVariation: string[];
  candidates: EngineCandidate[];
  explanation: string | null;
  explanationError: string | null;
};

export const DIFFICULTY_OPTIONS: Array<{
  id: EngineDifficulty;
  label: string;
  detail: string;
}> = [
  { id: "beginner", label: "入门", detail: "快速思考，适合熟悉规则" },
  { id: "casual", label: "休闲", detail: "有一定战术意识" },
  { id: "club", label: "进阶", detail: "俱乐部级搜索强度" },
  { id: "expert", label: "专家", detail: "更深搜索，更少失误" },
  { id: "master", label: "大师", detail: "最高强度，思考更久" },
];

type EngineRequest = {
  gameType: GameType;
  fen: string;
  history: string[];
  difficulty: EngineDifficulty;
  apiSettings?: ApiSettings;
};

async function requestEngine(endpoint: string, body: object): Promise<EngineAnalysis> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `引擎服务请求失败 (${response.status})`);
  }
  return payload;
}

export function getEngineMove(request: EngineRequest) {
  return requestEngine("/api/engine/move", request);
}

export function analyzePosition(request: EngineRequest, explain: boolean) {
  return requestEngine("/api/engine/analyze", {
    ...request,
    explain,
    multiPv: 3,
  });
}

export function formatEvaluation(evaluation: EngineEvaluation | null) {
  if (!evaluation) return "暂无评分";
  if (evaluation.type === "mate") {
    return evaluation.value > 0
      ? `行棋方 ${evaluation.value} 步内将杀`
      : `行棋方将在 ${Math.abs(evaluation.value)} 步内被将杀`;
  }
  const pawns = evaluation.value / 100;
  return `行棋方 ${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}