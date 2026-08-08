# Chess4AI

支持国际象棋和中国象棋的人机对弈与局面分析页面。

- 国际象棋由 Stockfish 负责对弈和多变例分析。
- 中国象棋由 Pikafish 负责对弈和多变例分析。
- 提供入门、休闲、进阶、专家、大师五档难度。
- 国际象棋显示 SAN 棋谱，中国象棋将内部 UCCI 走法转换为传统中文谱。
- 可选接入兼容 OpenAI Chat Completions 的大模型，对引擎结论生成中文讲解。大模型不参与最佳着计算。

## 项目目录

```text
Chess4AI/
├── .dockerignore               # Docker 构建上下文排除规则
├── .gitignore                  # Git 忽略规则
├── Dockerfile                  # 前端构建、Linux 引擎安装与生产镜像
├── compose.yaml                # Chess4AI 单服务容器部署
├── compose.caddy.yaml          # Chess4AI 与 Caddy 的组合部署
├── index.html                  # Vite HTML 入口
├── package.json                # npm 依赖和开发、构建、启动命令
├── package-lock.json           # npm 依赖版本锁定
├── scripts/
│   └── setup-engines.mjs       # 下载、解压并安装 Stockfish/Pikafish
├── server/
│   ├── engine.mjs              # UCI 引擎进程、难度和 MultiPV 结果解析
│   ├── explain.mjs             # 调用可选大模型生成局面中文讲解
│   └── index.mjs               # HTTP API、静态文件与 SPA 路由服务
├── public/
│   └── vite.svg                # Vite 模板资源，当前主流程未引用
├── src/
│   ├── main.tsx                # React 应用挂载入口
│   ├── App.tsx                 # 页面路由定义
│   ├── App.css                 # Vite 模板样式，当前入口未引用
│   ├── index.css               # Tailwind 和全局样式入口
│   ├── assets/
│   │   └── react.svg           # React 模板资源，当前主流程未引用
│   ├── components/
│   │   ├── AnalysisPanel.tsx   # 最佳着、评分和候选变例面板
│   │   ├── ApiSettingsModal.tsx # 可选讲解模型配置窗口
│   │   └── Layout.tsx          # 全局页面布局和设置入口
│   ├── lib/
│   │   ├── ai.ts               # 旧版通用模型直接走棋实现，主流程未引用
│   │   ├── engine.ts           # 前端引擎 API 客户端和分析类型
│   │   ├── xiangqi.ts          # 中国象棋棋盘、走法和王安全规则
│   │   └── xiangqiNotation.ts  # UCCI 到传统中文谱的转换
│   ├── pages/
│   │   ├── Home.tsx            # 国际象棋/中国象棋入口页
│   │   ├── ChessGame.tsx       # 国际象棋对弈和分析页
│   │   └── XiangqiGame.tsx     # 中国象棋对弈和分析页
│   └── store/
│       └── useStore.ts         # Zustand 设置和难度持久化状态
├── eslint.config.js            # ESLint 配置
├── postcss.config.js           # PostCSS 配置
├── tailwind.config.js          # Tailwind CSS 配置
├── tsconfig.json               # TypeScript 项目引用入口
├── tsconfig.app.json           # 浏览器端 TypeScript 配置
├── tsconfig.node.json          # Vite/Node 工具端 TypeScript 配置
├── vite.config.ts              # Vite 插件与开发 API 代理
└── README.md                   # 项目说明
```

| 模块 | 职责 |
| --- | --- |
| `src/pages` | 组织两种棋类的对弈流程、棋盘交互、悔棋和分析展示。 |
| `src/lib` | 封装前端引擎请求、中国象棋规则及中文记谱转换。 |
| `server` | 启动 Stockfish/Pikafish、限制并发任务，并统一提供页面与 `/api`。 |
| `scripts` | 根据当前操作系统安装对应的官方棋类引擎。 |
| `Dockerfile` / `compose*.yaml` | 构建 Linux 生产镜像，并选择直接暴露或通过 Caddy 提供 HTTPS。 |
| 根目录配置文件 | 管理 TypeScript、Vite、Tailwind、PostCSS、ESLint 和 npm 工具链。 |

## 本地运行

```bash
git clone https://github.com/Ksdb104/Chess4AI
npm install
npm run engines:setup
npm run dev
```

`npm run engines:setup` 会从 [Stockfish](https://github.com/official-stockfish/Stockfish/releases) 和 [Pikafish](https://github.com/official-pikafish/Pikafish/releases) 的官方 GitHub Releases 下载适合当前平台的引擎。引擎文件位于 `engines/`，不会提交到 Git。

安装器会先尝试从 GitHub Releases 下载 Stockfish 和 Pikafish。下载失败时，再回退到项目根目录中匹配当前平台的官方发行包（例如 `Pikafish.2026-01-02.7z`）；已取得 Release 元数据时会同时校验本地包大小。

默认地址：

- 页面：`http://localhost:5173`
- 本地引擎 API：`http://127.0.0.1:8787`

也可跳过自动安装并通过环境变量指定现有引擎：

```powershell
$env:STOCKFISH_PATH = "C:\path\to\stockfish.exe"
$env:PIKAFISH_PATH = "C:\path\to\pikafish.exe"
npm run dev
```

## 分析数据

分析接口返回最佳着、行棋方视角评分、搜索深度、三条候选着和主变化。设置讲解模型后，同一结果会额外附带自然语言说明；模型调用失败不会影响引擎结果。

## 服务器部署

不能只上传 `dist/`。浏览器还会访问 `/api/engine/*`，因此服务器必须同时运行 Node 服务、Stockfish 和 Pikafish。生产模式由同一个 Node 进程在 `8787` 端口提供静态页面和引擎 API。

### Docker Compose（推荐）

服务器需要 Docker Engine 和 Docker Compose。将项目上传或克隆到服务器后运行：

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8787/api/engines
```

访问 `http://服务器IP:8787`。`compose.yaml` 默认限制为 2 核、1 GB 内存和 2 个并发引擎任务，可按服务器配置修改。

Docker 构建会先从官方 GitHub Release 下载引擎；下载失败时才使用项目根目录中的匹配安装包。不要把 Windows 下已经安装的 `engines/` 复制进 Linux 容器，两种系统的可执行文件不兼容。

更新部署：

```bash
git pull
docker compose up -d --build
docker image prune -f
```

查看日志：

```bash
docker compose logs -f --tail=100
```

如果旧版本构建曾报 `stockfish 发行包解压失败`、Pikafish 解压出现 `7zip-bin/.../7za EACCES`，或者运行时提示 `Pikafish 意外退出，退出码 127`，更新代码后需要无缓存重建。新镜像使用系统 `tar`、Debian 原生 `p7zip-full`，并安装 Pikafish 所需的 `libatomic1` 和 `libstdc++6`；构建阶段还会执行一次 Pikafish NNUE/UCI 就绪检查：

```bash
git pull
docker compose build --no-cache chess4ai
docker compose up -d
```

使用 Caddy Compose 时，将上述命令中的 Compose 参数改为 `docker compose -f compose.caddy.yaml ...`。

### Ubuntu 裸机部署

安装 Node.js 20 后，在服务器执行：

```bash
sudo mkdir -p /opt/chess4ai
sudo chown "$USER":"$USER" /opt/chess4ai
git clone https://github.com/Ksdb104/Chess4AI /opt/chess4ai
cd /opt/chess4ai
npm ci
npm run build
npm run engines:setup
HOST=127.0.0.1 ENGINE_SERVER_PORT=8787 npm start
```

确认 `http://127.0.0.1:8787/` 和 `/api/engines` 正常后，再配置常驻服务：

```bash
sudo useradd --system --home /opt/chess4ai --shell /usr/sbin/nologin chess4ai
sudo chown -R chess4ai:chess4ai /opt/chess4ai
sudo cp deploy/chess4ai.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now chess4ai
sudo systemctl status chess4ai
```

### 域名和 HTTPS

#### 使用 Caddy（推荐）

先将域名的 A/AAAA 记录指向服务器，并在防火墙或云安全组开放 TCP 80、TCP 443 和 UDP 443。Caddy 会自动申请和续期 HTTPS 证书，不需要 Certbot。

Caddy 安装在宿主机、Chess4AI 使用 Docker 时，先把 `compose.yaml` 的端口映射改成仅本机可访问：

```yaml
ports:
	- "127.0.0.1:8787:8787"
```

安装配置并启动：

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl edit caddy
```

在打开的 systemd override 中填写实际域名：

```ini
[Service]
Environment=CHESS4AI_DOMAIN=chess.example.com
```

然后验证并加载：

```bash
sudo systemctl daemon-reload
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f
```

也可以让 Caddy 和 Chess4AI 都运行在 Docker 中。创建 `.env`：

```bash
echo 'CHESS4AI_DOMAIN=chess.example.com' > .env
docker compose -f compose.caddy.yaml up -d --build
docker compose -f compose.caddy.yaml logs -f caddy
```

此模式下应用端口不会发布到宿主机，Caddy 通过 Docker 网络访问 `chess4ai:8787`。`caddy_data` 卷保存证书，更新容器时不要删除该卷。

#### 使用 Nginx

将 `deploy/nginx.conf` 中的 `chess.example.com` 改为实际域名，然后执行：

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/chess4ai
sudo ln -s /etc/nginx/sites-available/chess4ai /etc/nginx/sites-enabled/chess4ai
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d chess.example.com
```

如果使用 Docker，建议把 `compose.yaml` 的端口映射改成 `127.0.0.1:8787:8787`，只允许 Nginx 访问容器。

### 生产注意事项

- 必须使用 HTTPS。讲解模型的 API Key 保存在用户浏览器中，并会通过本站后端转发；HTTP 会暴露密钥。
- 引擎接口会消耗 CPU。服务端默认最多并行 2 个任务；Nginx 示例额外提供按 IP 限流。标准版 Caddy 不内置请求频率限制，公开部署时可在 CDN/WAF 增加限流。
- 当前接口没有用户登录。如果要公开给不受信任的用户，建议再增加认证、请求配额和监控。
- 裸机部署时应在 Linux 服务器运行 `npm run engines:setup`，不要上传 Windows 的 `.exe`。

<img width="2574" height="1814" alt="image" src="https://github.com/user-attachments/assets/be6e19ee-ff35-4ba7-8ad6-b3461df77d97" />
<img width="2636" height="1814" alt="image" src="https://github.com/user-attachments/assets/f2d97dbc-3ebf-4e4c-bdc1-c91b2b38fa1f" />
<img width="2596" height="1810" alt="image" src="https://github.com/user-attachments/assets/b96f5a34-58d8-4449-9629-678778995101" />
<img width="2610" height="1818" alt="image" src="https://github.com/user-attachments/assets/bac47b9d-0416-4c1b-8b84-543c059908c5" />
<img width="2574" height="1812" alt="image" src="https://github.com/user-attachments/assets/1cd8546d-ad29-4b0e-86b5-471a6bd406df" />
<img width="752" height="1640" alt="image" src="https://github.com/user-attachments/assets/e56d78da-9c3d-4209-9b35-3a838d3c0c33" />
<img width="748" height="1640" alt="image" src="https://github.com/user-attachments/assets/985f1937-6100-46fe-ac26-396911679200" />
