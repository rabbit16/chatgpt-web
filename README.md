# ChatGpt-Web 本地开发说明

本仓库是 React + Vite 前端。本机为 Linux x86_64，请使用 **Node 18**（项目不兼容 Node 24）。

## 1. 环境要求

- Node.js `^16 || ^18 || ^19`（推荐 **18.20.8**）
- npm 10+
- 本机已通过 nvm 安装 Node 18 时，在项目目录执行：

```bash
cd ChatGpt-Web
source ~/.nvm/nvm.sh
nvm use          # 读取 .nvmrc，切换到 18.20.8
npm install
```

`.npmrc` 已配置国内镜像（npmmirror）和 `legacy-peer-deps`，直接 `npm install` 即可。

> 若从 macOS 拷贝过 `node_modules`，必须删掉后在 Linux 上重装，否则 SWC / esbuild 等原生模块无法运行。

## 2. 修改后端 URL

前端请求地址由 Vite 环境变量 `VITE_APP_REQUEST_HOST` 控制，代码读取位置：`src/request/index.ts`。

**配置文件不入库**：仓库只提供 `.env.example`，真实地址请复制后自行填写：

```bash
cp .env.example .env.development   # 开发
cp .env.example .env.production    # 打包
```

`.env`、`.env.development`、`.env.production` 已加入 `.gitignore`，不要提交。

**开发环境**（`npm start` 读取）编辑 `.env.development`：

```env
VITE_APP_ENV=development
VITE_APP_REQUEST_HOST=http://127.0.0.1:8888/apiAI
```

**生产打包**（`npm run build` 打进产物）编辑 `.env.production`：

```env
VITE_APP_ENV=production
VITE_APP_REQUEST_HOST=https://你的域名/apiAI
```

示例：

```env
VITE_APP_REQUEST_HOST=http://localhost:8888/apiAI
```

改完环境变量后必须**重启**开发服务，Vite 才会重新注入。

当前开发配置指向 `127.0.0.1:8888`。本仓库 `server/` 只是静态文件服务，不是业务 API；登录、计费依赖独立后端。

## 3. 启动与编译

```bash
cd ChatGpt-Web
source ~/.nvm/nvm.sh && nvm use

# 开发（默认 http://localhost:5173/）
npm start

# 生产编译，产物在 dist/
npm run build

# 预览打包结果
npm run preview
```

局域网访问：开发服务已开启 `host: 0.0.0.0`，可用本机 IP + 5173 端口。

## 4. 模型价格页

站内价格页路径：`/price`（侧栏「模型价格」）。

- 定价数据：`src/data/modelPricing.ts`
- 已接入 **OpenAI**（GPT-5.6 / GPT-6 等）和 **xAI Grok 4.6** 及相关模型
- 价格与费用估算只展示**美元（USD）**，不含人民币
- 调整价格后重新编译 / 刷新开发页即可生效
