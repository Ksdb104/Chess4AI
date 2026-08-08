import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const DIFFICULTIES = {
  beginner: { label: "入门", depth: 5, moveTime: 150, skill: 2 },
  casual: { label: "休闲", depth: 8, moveTime: 350, skill: 6 },
  club: { label: "进阶", depth: 12, moveTime: 800, skill: 12 },
  expert: { label: "专家", depth: 18, moveTime: 1600, skill: 18 },
  master: { label: "大师", depth: 24, moveTime: 3000, skill: 20 },
};

const ENGINE_CONFIG = {
  chess: {
    name: "Stockfish",
    environmentKey: "STOCKFISH_PATH",
    candidates: process.platform === "win32"
      ? ["engines/stockfish/stockfish.exe"]
      : ["engines/stockfish/stockfish"],
  },
  xiangqi: {
    name: "Pikafish",
    environmentKey: "PIKAFISH_PATH",
    candidates: process.platform === "win32"
      ? ["engines/pikafish/pikafish.exe"]
      : ["engines/pikafish/pikafish"],
  },
};

function getConfig(gameType) {
  const config = ENGINE_CONFIG[gameType];
  if (!config) {
    throw new Error(`不支持的棋类: ${gameType}`);
  }
  return config;
}

export async function resolveEngine(gameType) {
  const config = getConfig(gameType);
  const candidates = [
    process.env[config.environmentKey],
    ...config.candidates.map((candidate) => path.resolve(candidate)),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return { ...config, path: candidate, available: true };
    } catch {
      // Try the next configured location.
    }
  }

  return {
    ...config,
    path: candidates[0] ?? "",
    available: false,
  };
}

export function listDifficulties() {
  return Object.entries(DIFFICULTIES).map(([id, value]) => ({ id, ...value }));
}

function parseInfoLine(line) {
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;

  const depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
  const multiPv = Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1);
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pv = line.split(" pv ")[1]?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (!scoreMatch || pv.length === 0) return null;

  return {
    depth,
    multiPv,
    evaluation: {
      type: scoreMatch[1],
      value: Number(scoreMatch[2]),
      perspective: "sideToMove",
    },
    move: pv[0],
    variation: pv,
  };
}

export async function runEngine({
  gameType,
  fen,
  difficulty = "club",
  mode = "move",
  multiPv = 3,
}) {
  const engine = await resolveEngine(gameType);
  if (!engine.available) {
    throw new Error(
      `${engine.name} 未安装。请先运行 npm run engines:setup，或设置 ${engine.environmentKey}。`,
    );
  }

  const level = DIFFICULTIES[difficulty] ?? DIFFICULTIES.club;
  const analysisMode = mode === "analysis";
  const search = analysisMode
    ? { depth: 20, moveTime: 2500, skill: 20 }
    : level;
  const requestedMultiPv = analysisMode ? Math.max(1, Math.min(multiPv, 5)) : 1;

  return new Promise((resolve, reject) => {
    const processHandle = spawn(engine.path, [], {
      cwd: path.dirname(engine.path),
      windowsHide: true,
    });
    const candidates = new Map();
    let outputBuffer = "";
    let errorOutput = "";
    let settled = false;
    let initialized = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      processHandle.stdin.write("quit\n");
      processHandle.kill();
      if (error) reject(error);
      else resolve(result);
    };

    const timeout = setTimeout(() => {
      finish(new Error(`${engine.name} 在限定时间内没有返回结果。`));
    }, search.moveTime + 12_000);

    const sendSearch = () => {
      processHandle.stdin.write(`setoption name MultiPV value ${requestedMultiPv}\n`);
      processHandle.stdin.write(`setoption name Skill Level value ${search.skill}\n`);
      processHandle.stdin.write("setoption name Threads value 1\n");
      processHandle.stdin.write("setoption name Hash value 64\n");
      processHandle.stdin.write("isready\n");
    };

    const handleLine = (line) => {
      if (line === "uciok" && !initialized) {
        initialized = true;
        sendSearch();
        return;
      }

      if (line === "readyok") {
        processHandle.stdin.write("ucinewgame\n");
        processHandle.stdin.write(`position fen ${fen}\n`);
        processHandle.stdin.write(
          `go depth ${search.depth} movetime ${search.moveTime}\n`,
        );
        return;
      }

      const candidate = parseInfoLine(line);
      if (candidate) {
        const previous = candidates.get(candidate.multiPv);
        if (!previous || candidate.depth >= previous.depth) {
          candidates.set(candidate.multiPv, candidate);
        }
        return;
      }

      if (line.startsWith("bestmove ")) {
        const bestMove = line.split(/\s+/)[1];
        const sortedCandidates = [...candidates.values()].sort(
          (left, right) => left.multiPv - right.multiPv,
        );
        const primary = sortedCandidates[0];
        finish(null, {
          engine: engine.name,
          bestMove,
          depth: primary?.depth ?? search.depth,
          evaluation: primary?.evaluation ?? null,
          principalVariation: primary?.variation ?? (bestMove ? [bestMove] : []),
          candidates: sortedCandidates,
        });
      }
    };

    processHandle.stdout.on("data", (chunk) => {
      outputBuffer += chunk.toString();
      const lines = outputBuffer.split(/\r?\n/);
      outputBuffer = lines.pop() ?? "";
      lines.map((line) => line.trim()).filter(Boolean).forEach(handleLine);
    });

    processHandle.stderr.on("data", (chunk) => {
      const message = chunk.toString().trim();
      errorOutput = `${errorOutput}\n${message}`.trim().slice(-2000);
      console.error(`[${engine.name}] ${message}`);
    });

    processHandle.on("error", (error) => finish(error));
    processHandle.on("exit", (code) => {
      if (!settled) {
        const detail = errorOutput ? `：${errorOutput}` : "。";
        finish(new Error(`${engine.name} 意外退出，退出码 ${code ?? "未知"}${detail}`));
      }
    });

    processHandle.stdin.write("uci\n");
  });
}