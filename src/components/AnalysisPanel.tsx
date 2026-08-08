import React from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import {
  formatEvaluation,
  type EngineAnalysis,
} from "../lib/engine";

type AnalysisPanelProps = {
  analysis: EngineAnalysis | null;
  loading: boolean;
  error: string;
  canExplain: boolean;
  onAnalyze: () => void;
  formatMove: (move: string) => string;
  formatVariation: (variation: string[]) => string;
};

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  analysis,
  loading,
  error,
  canExplain,
  onAnalyze,
  formatMove,
  formatVariation,
}) => (
  <section className="border-t pt-4">
    <div className="flex items-center justify-between gap-3 mb-3">
      <h4 className="font-bold flex items-center gap-2">
        <Bot size={18} /> 局面分析
      </h4>
      <button
        onClick={onAnalyze}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:opacity-50 text-sm"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? "分析中" : "分析当前局面"}
      </button>
    </div>

    {!analysis && !error && (
      <p className="text-sm text-gray-500">
        引擎将给出最佳着、局面评分和三条候选变例。
      </p>
    )}
    {error && <p className="text-sm text-red-700 bg-red-50 p-3 rounded">{error}</p>}

    {analysis && (
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between bg-emerald-50 p-3 rounded">
          <div>
            <div className="text-gray-500">推荐着法</div>
            <div className="font-bold text-lg text-emerald-900">
              {formatMove(analysis.bestMove)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{formatEvaluation(analysis.evaluation)}</div>
            <div className="text-xs text-gray-500">
              {analysis.engine} · 深度 {analysis.depth}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {analysis.candidates.map((candidate) => (
            <div key={candidate.multiPv} className="bg-gray-50 p-2 rounded">
              <div className="flex justify-between font-medium">
                <span>候选 {candidate.multiPv}</span>
                <span>{formatEvaluation(candidate.evaluation)}</span>
              </div>
              <div className="font-mono text-xs mt-1 text-gray-600 break-words">
                {formatVariation(candidate.variation)}
              </div>
            </div>
          ))}
        </div>

        {analysis.explanation && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-3 leading-6 whitespace-pre-wrap">
            {analysis.explanation}
          </div>
        )}
        {analysis.explanationError && (
          <p className="text-xs text-amber-700">{analysis.explanationError}</p>
        )}
        {!canExplain && (
          <p className="text-xs text-gray-500">
            配置大模型 API 后，分析结果会附带中文原因讲解。
          </p>
        )}
      </div>
    )}
  </section>
);