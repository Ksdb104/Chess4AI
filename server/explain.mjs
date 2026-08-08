export async function explainAnalysis({ gameType, fen, history, analysis, settings }) {
  if (!settings?.baseUrl || !settings?.apiKey || !settings?.model) return null;

  const gameName = gameType === "chess" ? "国际象棋" : "中国象棋";
  const endpoint = `${settings.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `你是${gameName}教练。引擎数据是唯一事实来源，不得修改最佳着、分数或变例，不得声称未被数据支持的强制结果。`,
        },
        {
          role: "user",
          content: `请用简洁中文解释当前局面的最佳着为何合理，并概括主要威胁与对手应对。不要重复原始 JSON。\n\nFEN: ${fen}\n历史: ${history?.join(" ") || "无"}\n引擎结果: ${JSON.stringify(analysis)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`讲解模型请求失败 (${response.status})`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content?.trim() || null;
}