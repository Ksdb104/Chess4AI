import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { explainAnalysis } from "./explain.mjs";
import { listDifficulties, resolveEngine, runEngine } from "./engine.mjs";

const PORT = Number(process.env.ENGINE_SERVER_PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const STATIC_ROOT = path.resolve(process.env.STATIC_ROOT || "dist");
const MAX_ENGINE_JOBS = Math.max(1, Number(process.env.MAX_ENGINE_JOBS || 2));
const MAX_BODY_SIZE = 128 * 1024;
let activeEngineJobs = 0;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function sendStatic(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const resolvedPath = path.resolve(STATIC_ROOT, relativePath);
  const insideStaticRoot =
    resolvedPath === STATIC_ROOT || resolvedPath.startsWith(`${STATIC_ROOT}${path.sep}`);
  if (!insideStaticRoot) {
    sendJson(response, 403, { error: "禁止访问该路径。" });
    return true;
  }

  let filePath = resolvedPath;
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) throw new Error("Not a file");
  } catch {
    filePath = path.join(STATIC_ROOT, "index.html");
  }

  try {
    const content = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
      "Cache-Control": isHashedAsset
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    sendJson(response, 503, {
      error: "前端构建不存在，请先运行 npm run build。",
    });
  }
  return true;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
        reject(new Error("请求内容过大。"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("请求 JSON 无效。"));
      }
    });
    request.on("error", reject);
  });
}

async function getStatus() {
  const [chess, xiangqi] = await Promise.all([
    resolveEngine("chess"),
    resolveEngine("xiangqi"),
  ]);
  return {
    engines: {
      chess: { name: chess.name, available: chess.available },
      xiangqi: { name: xiangqi.name, available: xiangqi.available },
    },
    difficulties: listDifficulties(),
  };
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/engines") {
      sendJson(response, 200, await getStatus());
      return;
    }

    if (
      request.method === "POST" &&
      (request.url === "/api/engine/move" || request.url === "/api/engine/analyze")
    ) {
      if (activeEngineJobs >= MAX_ENGINE_JOBS) {
        sendJson(response, 429, { error: "引擎繁忙，请稍后重试。" });
        return;
      }

      const body = await readJson(request);
      if (!body.gameType || !body.fen) {
        sendJson(response, 400, { error: "gameType 和 fen 必填。" });
        return;
      }

      const mode = request.url.endsWith("/analyze") ? "analysis" : "move";
      activeEngineJobs += 1;
      let analysis;
      try {
        analysis = await runEngine({
          gameType: body.gameType,
          fen: body.fen,
          difficulty: body.difficulty,
          mode,
          multiPv: body.multiPv,
        });
      } finally {
        activeEngineJobs -= 1;
      }

      let explanation = null;
      let explanationError = null;
      if (mode === "analysis" && body.explain) {
        try {
          explanation = await explainAnalysis({
            gameType: body.gameType,
            fen: body.fen,
            history: body.history,
            analysis,
            settings: body.apiSettings,
          });
        } catch (error) {
          explanationError = error instanceof Error ? error.message : "讲解生成失败。";
        }
      }

      sendJson(response, 200, { ...analysis, explanation, explanationError });
      return;
    }

    if (request.url?.startsWith("/api/")) {
      sendJson(response, 404, { error: "接口不存在。" });
      return;
    }

    await sendStatic(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "引擎服务发生未知错误。";
    console.error(message);
    sendJson(response, 500, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chess4AI server: http://${HOST}:${PORT}`);
});