import { spawn, spawnSync } from "node:child_process";
import { chmodSync, createWriteStream } from "node:fs";
import { access, appendFile, chmod, copyFile, mkdir, readFile, readdir, rm, stat, truncate } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import sevenZip from "7zip-bin";

const ROOT = process.cwd();
const TEMP = path.join(ROOT, ".engine-downloads");

const RELEASES = [
  {
    id: "stockfish",
    repository: "official-stockfish/Stockfish",
    assetPattern: process.platform === "win32"
      ? /^stockfish-windows-x86-64\.zip$/
      : process.platform === "darwin"
        ? /^stockfish-macos-(m1-apple-silicon|x86-64)\.tar$/
        : /^stockfish-ubuntu-x86-64\.tar$/,
    executablePattern: process.platform === "win32"
      ? /^stockfish-windows-x86-64\.exe$/i
      : /^stockfish-(ubuntu-x86-64|macos-m1-apple-silicon|macos-x86-64)$/i,
  },
  {
    id: "pikafish",
    repository: "official-pikafish/Pikafish",
    assetPattern: /\.7z$/i,
    executablePattern: process.platform === "win32"
      ? /^pikafish.*\.exe$/i
      : /^pikafish.*(sse41-popcnt|avx2|bmi2|avx512|avxvnni|vnni512|apple-silicon|armv8)$/i,
    executablePreference: ["sse41-popcnt", "avx2", "bmi2", "x86-64"],
  },
];

async function findFiles(directory, predicate) {
  const matches = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) matches.push(...await findFiles(entryPath, predicate));
    else if (predicate(entry.name)) matches.push(entryPath);
  }
  return matches;
}

async function downloadChunk(url, destination, start, end, append) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: {
      Accept: "application/octet-stream",
      "User-Agent": "Chess4AI-setup",
      "X-GitHub-Api-Version": "2022-11-28",
      Range: `bytes=${start}-${end}`,
    },
  });
  if (response.status !== 206) {
    throw new Error(`服务器不支持分块下载 (${response.status}): ${url}`);
  }
  if (!response.body) throw new Error(`下载响应没有内容: ${url}`);

  await pipeline(
    Readable.fromWeb(response.body),
    new Transform({ transform: (chunk, _encoding, callback) => callback(null, chunk) }),
    createWriteStream(destination, { flags: append ? "a" : "w" }),
  );
}

async function download(url, destination, totalSize) {
  const chunkSize = 8 * 1024 * 1024;
  await rm(destination, { force: true });

  if (process.platform === "win32") {
    const chunks = [];
    const argumentsList = [
      "--parallel",
      "--parallel-max", "4",
    ];

    for (let start = 0; start < totalSize; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, totalSize - 1);
      const chunkPath = `${destination}.part-${chunks.length}`;
      if (chunks.length > 0) argumentsList.push("--next");
      chunks.push(chunkPath);
      argumentsList.push(
        "--location",
        "--fail",
        "--silent",
        "--show-error",
        "--retry", "3",
        "--retry-all-errors",
        "--connect-timeout", "30",
        "--max-time", "600",
        "--header", "Accept: application/octet-stream",
        "--header", "User-Agent: Chess4AI-setup",
        "--header", "X-GitHub-Api-Version: 2022-11-28",
        "--url", url,
        "--range", `${start}-${end}`,
        "--output", chunkPath,
      );
    }

    console.log(`  使用 curl 并行下载 ${chunks.length} 个分块...`);
    await new Promise((resolve, reject) => {
      const curl = spawn("curl.exe", argumentsList, { stdio: "inherit" });
      curl.on("error", reject);
      curl.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`curl 下载失败，退出码 ${code}。`)),
      );
    });

    for (const chunk of chunks) {
      await appendFile(destination, await readFile(chunk));
      await rm(chunk, { force: true });
    }
  } else {
    for (let start = 0; start < totalSize; start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, totalSize - 1);
      let completed = false;
      let lastError;

      for (let attempt = 1; attempt <= 3 && !completed; attempt++) {
        try {
          if (start > 0) await truncate(destination, start);
          await downloadChunk(url, destination, start, end, start > 0);
          completed = true;
        } catch (error) {
          lastError = error;
          if (attempt < 3) console.warn(`  分块下载失败，正在重试 (${attempt}/3)...`);
        }
      }
      if (!completed) throw lastError;
      console.log(`  下载进度 ${Math.round(((end + 1) / totalSize) * 100)}%`);
    }
  }

  const downloaded = await stat(destination);
  if (downloaded.size !== totalSize) {
    throw new Error(`下载大小不一致，预期 ${totalSize}，实际 ${downloaded.size}。`);
  }
}

async function findLocalArchive(config, asset) {
  const rootFiles = await readdir(ROOT, { withFileTypes: true });
  const candidates = rootFiles
    .filter((entry) => entry.isFile() && config.assetPattern.test(entry.name))
    .map((entry) => path.join(ROOT, entry.name));
  const exactMatch = asset
    ? candidates.find((candidate) => path.basename(candidate) === asset.name)
    : null;
  const localArchivePath = exactMatch ?? candidates[0];

  if (!localArchivePath) {
    throw new Error(`${config.id} 的 GitHub 下载失败，根目录也没有匹配的安装包。`);
  }

  if (asset) {
    const localArchive = await stat(localArchivePath);
    if (localArchive.size !== asset.size) {
      throw new Error(
        `本地 ${path.basename(localArchivePath)} 大小不正确，预期 ${asset.size}，实际 ${localArchive.size}。`,
      );
    }
  }

  console.log(`改用根目录安装包 ${path.basename(localArchivePath)}。`);
  return localArchivePath;
}

function extractArchive(sourceArchive, extractPath) {
  const archiveName = path.basename(sourceArchive).toLowerCase();
  const isTarArchive = archiveName.endsWith(".tar");
  let command = isTarArchive ? "tar" : sevenZip.path7za;
  const argumentsList = isTarArchive
    ? ["-xf", sourceArchive, "-C", extractPath]
    : ["x", sourceArchive, `-o${extractPath}`, "-y"];

  if (!isTarArchive && process.platform !== "win32") {
    const systemCommand = ["7za", "7zz", "7z"].find((candidate) => {
      const probe = spawnSync(candidate, ["i"], { stdio: "ignore" });
      return probe.status === 0;
    });
    if (systemCommand) {
      command = systemCommand;
    } else {
      try {
        chmodSync(sevenZip.path7za, 0o755);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`系统 7za 不可用，且无法为内置 7za 设置执行权限：${message}`);
      }
    }
  }

  const result = spawnSync(command, argumentsList, {
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) return;

  const reason = result.error
    ? result.error.message
    : result.signal
      ? `被信号 ${result.signal} 终止`
      : `退出码 ${result.status ?? "未知"}`;
  throw new Error(`${path.basename(sourceArchive)} 解压失败：${reason}`);
}

async function installEngine(config) {
  const targetPath = path.join(ROOT, "engines", config.id);
  const executableName = process.platform === "win32" ? `${config.id}.exe` : config.id;
  const installedExecutable = path.join(targetPath, executableName);
  try {
    await access(installedExecutable);
    console.log(`${config.id} 已安装，跳过下载。`);
    return;
  } catch {
    // Continue with installation.
  }

  let release;
  let asset;
  let sourceArchive;
  try {
    console.log(`正在从 GitHub 获取 ${config.id} 最新版本...`);
    const releaseResponse = await fetch(
      `https://api.github.com/repos/${config.repository}/releases/latest`,
      { headers: { "User-Agent": "Chess4AI-setup" } },
    );
    if (!releaseResponse.ok) throw new Error(`GitHub API 返回 ${releaseResponse.status}。`);

    release = await releaseResponse.json();
    asset = release.assets.find((item) => config.assetPattern.test(item.name));
    if (!asset) throw new Error(`${config.id} 没有适用于当前平台的官方发行包。`);

    const archivePath = path.join(TEMP, asset.name);
    console.log(`正在下载 ${asset.name} (${Math.round(asset.size / 1024 / 1024)} MB)...`);
    await download(asset.url, archivePath, asset.size);
    sourceArchive = archivePath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${config.id} GitHub 安装失败：${message}`);
    sourceArchive = await findLocalArchive(config, asset);
  }

  const extractPath = path.join(TEMP, `${config.id}-extract`);
  await rm(extractPath, { recursive: true, force: true });
  await rm(targetPath, { recursive: true, force: true });
  await mkdir(extractPath, { recursive: true });
  await mkdir(targetPath, { recursive: true });
  extractArchive(sourceArchive, extractPath);

  const executables = await findFiles(extractPath, (name) => config.executablePattern.test(name));
  if (executables.length === 0) {
    throw new Error(`未在 ${path.basename(sourceArchive)} 中找到 ${config.id} 可执行文件。`);
  }

  executables.sort((left, right) => {
    const preference = config.executablePreference ?? [];
    const rank = (file) => {
      const index = preference.findIndex((token) => file.toLowerCase().includes(token));
      return index === -1 ? preference.length : index;
    };
    return rank(left) - rank(right);
  });

  await copyFile(executables[0], path.join(targetPath, executableName));
  if (process.platform !== "win32") await chmod(path.join(targetPath, executableName), 0o755);

  const networks = await findFiles(extractPath, (name) => name.endsWith(".nnue"));
  for (const network of networks) {
    await copyFile(network, path.join(targetPath, path.basename(network)));
  }
  console.log(`${config.id} ${release?.tag_name ?? "本地版本"} 安装完成。`);
}

await mkdir(TEMP, { recursive: true });
try {
  for (const config of RELEASES) await installEngine(config);
} finally {
  await rm(TEMP, { recursive: true, force: true });
}

console.log("引擎安装完成，可以运行 npm run dev。");