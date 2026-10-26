# 与站长仓库的协作与同步方案

> 目的：你在这里和我改前端，站长在 GitHub 上维护/部署，两边不打架、不丢改动、可回滚。
> 适用仓库：`rabbit16/chatgpt-web`（`main` + `release`）
>
> **2026-10-27 站长改规矩**：`feature/dev` 已合并进 `release` 并删除（本地 + 远程都已删）。以后**开发一律从 `release` 拉分支**，不再有 dev 这条线。

---

## 1. 结论：三层结构，单向交付

```
┌──────────────────────┐    push     ┌─────────────────┐   merge   ┌──────────────┐
│ 本地工作区 (这里)      │ ─────────> │ feat/xxx        │ ───────> │   release    │
│ 设计 + 代码 + 截图     │            │ 每次任务一个分支  │          │ 集成/验收     │
└──────────────────────┘            └─────────────────┘          └──────┬───────┘
          ↑                                                              │
          │                    fetch + rebase（每次对话开始）             │ 站长构建/部署
          └──────────────────────────────────────────────────────────────┘
                                                                         ↓
                                                                    线上 www.rabbitj.top
```

- **`main`**：发布分支，只由站长合并/发布；
- **`release`**：**主开发分支**（原 `feature/dev` 的内容已全部合并进来）。新任务一律从这里拉分支；
- **`feat/xxx`**：每个任务一个短分支（如 `feat/redesign-chat`），完成后由站长合并进 `release`；
- **本地工作区**：设计稿、截图、临时文件可以留在本地，只有"要交付的"才进仓库。

> 不建议直接在 `main` 或 `release` 上改，也不建议我和站长同时改同一批文件。
> `release` 现在是站长合并进来的集成分支：**我推任务分支、他去合**；只有他明确说"直接推 release"时才直接推。

---

## 2. 每次对话的同步节奏

### 2.1 开始（我每次先做）

```bash
cd chatgpt-web
git fetch --all --prune                  # --prune 会把已删掉的 feature/dev 从本地记录里清掉
git status
git log --oneline HEAD..origin/main      # 站长是否已合入 main
git log --oneline HEAD..origin/release   # release 是否有新提交（站长部署的版本）
git rebase origin/release                # 有就把我的分支接上去
```

> 现在只有 `main` 和 `release` 两条主线：**`release` 看着写代码，`main` 看着对线上**。每次两边都要看。

我给你一句同步报告：

> 站长新增 2 个提交（已进 release），涉及 `src/pages/price`；我的分支已同步，无冲突。

### 2.2 工作中

- 一个任务一个分支，**分支从最新 `origin/release` 开出**；
- 小步提交，提交信息写清改了什么；
- 页面截图、对比图先放本地，任务完成再选几张进 PR 描述；
- 不碰 `.env`、不碰站长负责的接口逻辑。

### 2.3 任务完成（我执行，你确认）

```bash
npm run build                                        # 必须通过
git add -A
git commit -m "feat(ui): 重构对话页三栏布局"
git push origin HEAD:refs/heads/feat/redesign-chat   # 只推任务分支，站长来合
```

- 任务分支留作备份和对比；**合并进 `release` 由站长做**；
- **只推任务分支，不推 release、不碰 main、不部署**；
- 推完给站长一句：改了哪些页面、是否需要重新构建、有没有接口变动。

### 2.4 站长侧

- 站长把任务分支合并到 `release`，由他构建、部署；
- 我不碰线上服务器；
- 如果他先合了自己的改动，我下次会把 `release` 合进我的任务分支，保持两边接近；
- 部署完我用浏览器截图复核线上，确认没有回归。

---

## 3. 到底同步哪些内容

| 内容 | 同步 | 位置 / 说明 |
|---|---|---|
| 页面与组件代码 `src/**` | ✅ | 必须 |
| 静态资源 `public/**`、logo、字体 | ✅ | 字体要子集化，别整包丢进去 |
| `index.html`、`vite.config.ts`、`tsconfig*.json` | ✅ | 必须 |
| `package.json` | ✅ | 加依赖时同步 |
| `package-lock.json` | ⚠️ 建议纳入 | 当前被 `.gitignore` 忽略，两边装出的版本可能不同 |
| `.env.example` | ✅ | 只放占位值 |
| `.env.development` / `.env.production` | ❌ | 本地/服务器配置，不入库 |
| 设计规范 `docs/design-spec.md` | ✅ | 站长能照着验收 |
| 后端接口文档 `docs/api/**` | ✅ | 站长接入用，建议进仓库 |
| 截图（before/after） | ⚠️ 精选 | 放 PR 描述或 `docs/design/shots/`，压缩后少量提交 |
| 模板网页源文件 | ❌ | 版权/体积问题，只保留链接或截图 |
| `node_modules`、`dist`、`build` | ❌ | 已在 `.gitignore` |
| 测试账号、密钥、真实域名 | ❌ | 绝不入库 |
| Figma / 设计源文件 | 🔗 链接 | 需要时放 PR 或文档链接 |

---

## 4. 当前仓库需要先修的 4 件事

| 问题 | 现状 | 处理 |
|---|---|---|
| ~~本地 `feature/dev` 无 upstream~~ | 已随 dev 分支删除而作废 | 现在跟踪 `main` + `release` 两条即可 |
| Git 提交身份为空 | `user.name` / `user.email` 未配置 | 配一个提交身份（你定名字/邮箱） |
| `package-lock.json` 被忽略 | `.gitignore` 第 10 行 | 建议移除忽略、提交锁文件，保证两边构建一致 |
| `tsconfig.node.json` 改动未提交 | 修构建的 `skipLibCheck` | 作为第一条基线提交 |

> 这些不改，同步会出现：推不上去、提交作者不对、两边依赖版本漂移、构建报错。

---

## 5. 冲突与回滚

- **先拉后改**：每次开始 fetch + rebase，减少冲突；
- **小步交付**：一个任务一个分支，避免长期大分支；
- **不 force push 共享分支**：`main`、`release` 永远不强制推；
- **冲突处理**：代码冲突我来解；`package-lock` 冲突直接 `npm install` 重生成；
- **回滚**：每个任务分支保留；发布前打 tag（如 `design-v1`）；线上出问题由站长回滚到上一个 tag；
- **备份**：大改前我本地打 `backup/日期` 分支或 tag。

---

## 6. 我能帮你做什么 / 不能做什么

**能：**

- 每次对话开始自动 fetch、检查站长新提交、rebase；
- 按任务建分支、提交、推送、给你 PR 链接；
- 构建检查、截图验收、线上复核；
- 维护 `docs/design-spec.md`、`docs/api/**`、同步记录；
- 发生冲突时处理并告诉你影响范围。

**不能：**

- 7×24 盯着 GitHub（只有你和我对话时才会检查）；
- 未经你同意推 `main` 或强推共享分支；
- 替站长部署服务器（除非给部署权限/脚本）；
- 猜测站长没写进仓库的接口变更。

---

## 7. 站长已确认的规则（2026-10-21）

| 事项 | 答复 | 对流程的影响 |
|---|---|---|
| 发布分支 | 站长合并到 `release` 再部署 | 我只推任务分支，不碰 `main`/`release`，不部署 |
| 站长是否开发 | 会，但会新建自己的分支 | 我每次同时看 `main` 和 `release`，避免冲突 |
| 我的推送权限 | 可推任务分支（2026-10-27 站长改规矩） | 任务分支推上去，由站长合并进 `release` |
| 文档/锁文件 | 进仓库，一起收纳 | 建 `docs/design/`、`docs/api/`，并提交 `package-lock.json` |

## 8. 提交身份怎么定

Git 每次提交会记录两个字段，和“登录账号”不是一回事：

- `user.name`：显示的名字，可任意填；
- `user.email`：GitHub 用邮箱把提交归到你账号；用 GitHub 的 `noreply` 邮箱最安全，不暴露真实邮箱。

当前这台机器 SSH 登录的是 **`rabbit16`（站长账号）**，所以推送权限是站长的。提交身份有三种选择：

| 方案 | 名字 / 邮箱 | 适用 |
|---|---|---|
| **A. 用站长账号（默认推荐）** | `rabbit16` / `54702866+rabbit16@users.noreply.github.com` | 你没有自己的 GitHub 账号，或不在意归属 |
| **B. 用你自己的账号** | 你的用户名 / `<数字ID>+<用户名>@users.noreply.github.com` | 你有 GitHub 账号，想让提交归你；把用户名给我即可 |
| **C. 中性身份** | `anyGPT Frontend` / `frontend@rabbitj.top` | 不想归属到任何个人账号，提交会显示未验证 |

> 方案 A 的邮箱来自 GitHub 的公开 ID，可直接用；提交会显示站长头像。  
> 方案 B 需要你的 GitHub 用户名，我来查数字 ID；推送仍走站长这台机器的 SSH key。

**本项目已配置为方案 B：**

```text
user.name  = AUGUSTQJR
user.email = 342583573+AUGUSTQJR@users.noreply.github.com
```

GitHub 会把提交归到 [AUGUSTQJR](https://github.com/AUGUSTQJR) 账号；推送认证仍使用本机 SSH key（rabbit16），所以推送记录显示为站长账号，作者显示为你。

## 9. 初始化步骤（身份确定后执行）

1. 修 fetch refspec，让 `main` 和 `release` 都能跟踪；
2. 设置提交身份；
3. 从 `.gitignore` 移除 `package-lock.json`，重新生成并提交；
4. 在仓库建 `docs/design/`、`docs/api/`、`docs/collaboration.md`，把该同步的文档放进去；
5. 新建任务工作分支（从 `origin/release`）；
6. 提交基线（`tsconfig.node.json` 修复 + 锁文件 + 文档）；
7. 推送任务分支（**不部署、不碰 main / release**）；
8. 给你同步报告和站长可核对的文件清单。

> 每次任务结束后，你只需要看一眼我的同步报告，确认“推 / 不推”。
