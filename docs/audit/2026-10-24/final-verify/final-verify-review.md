# 视觉改造最终验收 · Finish-Gate

**日期**：2026-10-24　**角色**：UI 视觉验收设计师（Design QA）
**性质**：只读实测，**未改任何一行代码**（`git status` 与验收前一致）
**环境**：`http://127.0.0.1:5173`（未重启、未 pkill）
**范围**：9 页 × 2 视口（1440×900 / 390×844）× 浅色/深色 = 36 组，全部实测
**对照基线**：`docs/audit/2026-10-24/ui-design/ui-design-review.md`（方案 A）
**证据**：本目录 70 张截图 + 9 份实测日志（`overflow.log` / `misc.log` / `detail.log` / `dark.log` / `login-reg.log` / `grid.log`）

---

## 一、结论

**有条件通过。**

改造的主体做到了：**标题刻度、栅格（除发票页）、零横向溢出、深色对比度、手机端档位卡、品牌硬伤** 六个方面实测达标，可以上线。但有 **4 个阻塞项**必须在本轮内改完，全部是小改动（改选择器优先级、改一个容器 class、补两处 `formatCny`、改一处 deep token），不涉及新设计。

---

## 二、验收表

| # | 项目 | 结果 | 实测证据 |
|---|---|---|---|
| 1 | 9 页 × 2 档零横向溢出 | ✅ | 36 组全部 `scrollWidth-clientWidth = 0`，滚到最右 `scrollX = 0`；见第五节 |
| 2 | P1 标题刻度 | ✅ | 1440：除首页 hero 44px（唯一例外）外 8 页均 **28px**；390：`/` 28 / 其余 **22px**，仅 `/guide` 23px（⚠️ 见瑕疵）；发票页 H1「开票中心」存在 |
| 3 | P2 发票页 | ❌ | H1 28px@y108 ✅、三卡等宽 439px 一行 ✅、记录 y=265 在首屏 ✅；**但零值「暂无」实测 26px（要求 14px）**，`还能开` **26px 黑色（要求 22px 品牌蓝）** |
| 4 | P3 金额规约 | ⚠️ | 表格列已走 `formatCny`（`¥0.009378` 六位去零 ✅）；**但同一页仍有 4 位小数：总消费 `¥545.3650`、本页扣费 `¥0.1484`、余额列 `¥124.8814`**；钱包页余额 26px 品牌蓝等宽 ✅ |
| 5 | P4 品牌硬伤 | ✅ | 登录页水印 `/logo-rabbit.svg`（260×260）、页脚与弹窗均 `rabbitJ`、全站 `anyGPT` 出现 0 次 |
| 6 | P5 栅格 | ❌ | `/guide` 880 ✅；**`/invoice` 实测容器仍 1349px 满宽、H1 x=40**（其余页 x=115/125/130）；三卡 439px 因此落在 1349 容器里 |
| 7 | P6 手机端 | ✅ | 5 张档位卡全部 318×64/77、`x=38` 均在屏内、无裁断（`clipped:false`）；余额卡 318×122，标签 13px → 24px 金额 → 折扣副行 |
| 8 | P7 深色 | ⚠️ | 金额对比度最低 **5.66:1**（112 个节点全 ≥4.5）✅；全站白块 0 ✅；**主按钮实测白字 `#5078cf` = 4.26:1，未过 4.5** |
| 9 | P8 页签/按钮 | ❌ | 价格页药丸已统一（全圆、13px、浅蓝选中 ✅）；**内部药丸仍 `8px`、页签槽 999/999/12 三样，选中态白底黑字与浅蓝两套并存；行内按钮 28px 仍存在** |
| 10 | 回归 | ✅ | 加载骨架（首帧 skeleton 7 → 1，无白屏）、发票教学块 y=767 页底、后台两表（invoices 9 列/7 行、usage 70 行）、菜单热区 **64×40**、公告弹窗不拦登录页 |
| 11 | 浅/深两套都看 | ✅ | 36 组两主题全跑，`data-theme` 实测切换正确 |

---

## 三、必须修的问题（4 条，全部有精确改法）

### ❌ 1. 发票页零值卡字号没有被降级，`还能开` 也不是品牌蓝
**页面/视口**：`/invoice` · 1440 与 390
**现象**：`.summaryEmpty` 写了 14px，但 `.summaryCard b { font-size: 26px }` 选择器权重更高，把「暂无」压回 26px —— 页面上最大的字依旧是"没有钱"，方案 A 的核心目的没达成。`¥370.00` 也是 26px `rgb(16,24,40)` 黑色。
**实测**：`empty.fs = 26px, fw=500, color=rgb(16,24,40)`；`keep.fs = 26px, color=rgb(16,24,40)`
**改法**：`src/pages/invoice/index.module.less`
- 第 58 行 `.summaryEmpty` 提到 `.summaryCard` **之前**不够，改为提高权重：`.summaryCard .summaryEmpty { font-size: 14px; font-weight: 500; color: var(--text-4); }`（或直接 `.summaryCard b.summaryEmpty`）
- `.summaryCard b` 内加非零值配色，给 `还能开` 用：新增 `.summaryCard[data-primary] b { font-size: 22px; font-weight: 600; color: var(--brand); }`，并在 `index.tsx` 给 `还能开` 那张卡加 `data-primary`

### ❌ 2. 发票页容器没收到 1200，`.wrap` 是死代码
**页面/视口**：`/invoice` · 1440
**现象**：`invoice/index.module.less` 的 `.wrap` 已改成 `max-width: var(--content-max)`，但 `page.tsx` 只渲染 `<div className={styles.page}><Layout><InvoicePanel /></Layout></div>`，**没有任何元素用 `.wrap`**。页面因此走 Layout 满宽，H1 在 x=40、内容宽 1349，与全站 115/125/130 三个左边界都不对齐（P5 未落地）。
**实测**：`summaryRow = {x:40, w:1349}`；`h1 x=40`；对比 `/guide` h1 x=299（880 容器生效）
**改法**：`src/pages/invoice/page.tsx` 给 `InvoicePanel` 外包一层 `<div className={styles.wrap}>`，或把 `.wrap` 的 `max-width/padding/margin` 合并进 `.page`；改完 H1 应落在 x≈139、三卡各 389px

### ❌ 3. 用量页仍有 4 位小数金额（P3 只改了一半）
**页面/视口**：`/usage` · 两档
**现象**：`formatMoney`（表格列）已换 `formatCny`，但统计卡和余额列仍是手写 `toFixed(4)`：总消费 `¥545.3650`、本页扣费 `¥0.1484`、表格「当前余额」`¥124.8814`。规则要求 ≥1 元两位小数，`¥545.3650` 明显违反；小额 `¥0.1484` 也应去尾零。
**实测**：`¥545.3650` / `¥0.1484` / `¥124.8814` / `¥0.007686`（同类混排）
**改法**：`src/pages/usage/index.tsx`
- 第 57 行 `formatBalance`：`¥{Number(value).toFixed(4)}` → `formatCny(value)`
- 第 62 行 `formatRecharge`：`toFixed(2)` → `formatCny(value)`
- 第 383 行总消费 `` `¥${Number(charged).toFixed(4)}` `` → `formatCny(charged)`
- 第 390 行 `本页扣费` `` ¥{pageCharged.toFixed(4)} `` → `formatCny(pageCharged)`

### ❌ 4. 深色主按钮 4.26:1 未达标；行内 28px 按钮残留
**页面/视口**：全站主按钮 · 深色；`/usage`、`/price?tab=wallet` · 1440
**现象 A（对比度）**：`theme.ts` 把 `colorPrimary` 改成 `#5b8af0`，但 antd 深色算法再推导后实际渲染为 `rgb(80,120,207)`，字色仍是白字，**实测 4.26:1 < 4.5**；`--text-inverse: #141417` 写在 token 里但没被按钮用上（近黑字在 `#5b8af0` 上是 5.55:1，达标）。
**现象 B（28px）**：`global.less:284` 规则是 `.ant-btn.ant-btn-sm:not(.ant-btn-link):not(.ant-btn-text)`，而残留的 28px 按钮恰恰全是 **link 类型**：`/usage` 的 18 个「复制 ID」、`/invoice` 的「开发票 / 重新申请」。
**实测**：`darkBtn = {bg: rgb(80,120,207), color: rgb(255,255,255), ratio: 4.26}`；`minBtn = 28`（usage 与 wallet 页）
**改法**：
- `src/styles/theme.ts` 深色 `components.Button` 增加 `primaryColor: '#141417'`（近黑字），或 `token.colorTextLightSolid: '#141417'`；改后复测应 ≥5.5:1
- `src/styles/global.less:284` 去掉 `:not(.ant-btn-link):not(.ant-btn-text)` 两个排除项，改为 `.ant-btn.ant-btn-sm { min-height: 32px; padding-block: 3px; }`；纯图标小按钮如需豁免，用 `.ant-btn-sm.ant-btn-icon-only` 单独排除

---

## 四、可接受的小瑕疵（不要求改）

1. `/guide` 390 下 H1 是 **23px**（`guide/index.module.less:939` 写死 23px，其余页 22px）——差 1px，肉眼不可辨，且该页 880 窄容器已生效。
2. 页签内部药丸仍是 **8px 圆角**、槽出现 `999 / 999 / 12` 三种（`notice` 用自己的一套 `.tabs` 没换 PillTabs）；选中态白底黑字（usage/projects/notice）与浅蓝底蓝字（price/wallet）**两套并存**。外层已全圆，观感上已改善，属 P8 的"未全统一"而非破坏。
3. `/projects` H1 x=154、`/usage` `notice` x=149，与 `/price` 的 139 差 10–15px（各自 `--container-pad` 24 vs 40）。上一轮就已存在，非本轮回归。
4. 后台 `/admin/invoices` 表格 `scrollWidth 1200 > clientWidth 1109`（表内横向滚动，符合上一轮"保留 scroll.x"的决定）。
5. 登录页 390 深色结构完整，`modalCount 0`（公告弹窗不拦登录页 ✅），无 h1（登录页本不需要）。
6. 顶栏头像仍是「注册首字 钱」——**用户明确要求保留，未计入缺陷**。

---

## 五、横向溢出汇总表（`scrollWidth - clientWidth`，36 组）

| 页面 | 1440 浅 | 1440 深 | 390 浅 | 390 深 |
|---|---|---|---|---|
| `/` | 0 | 0 | 0 | 0 |
| `/price` | 0 | 0 | 0 | 0 |
| `/price?tab=wallet` | 0 | 0 | 0 | 0 |
| `/invoice` | 0 | 0 | 0 | 0 |
| `/usage` | 0 | 0 | 0 | 0 |
| `/notice` | 0 | 0 | 0 | 0 |
| `/guide` | 0 | 0 | 0 | 0 |
| `/projects` | 0 | 0 | 0 | 0 |
| `/login` | 0 | 0 | 0 | 0 |

> 每格另测「滚到最右」`window.scrollX`，36 组全为 **0**，即横向根本不可滚动，非"被隐藏"。
> 说明：1440 下 `documentElement.scrollWidth` 为 1429（滚动条占 11px），`innerWidth 1440`，故 `scrollWidth - innerWidth` 会是 -11；按任务口径取 `scrollWidth - clientWidth`，真实值均为 0。

---

## 六、通过条件

改完第三节 4 条 → 重跑 `/invoice`、`/usage` 两页的 1440 + 390 浅/深 + 深色主按钮对比度，确认：

1. `/invoice` 零值「暂无」14px、`还能开` 22px 品牌蓝、H1 x≈139、三卡各 ≈389px；
2. `/usage` 不再出现 `¥545.3650` 这类 4 位小数；
3. 深色主按钮对比度 ≥4.5:1；
4. 行内按钮 `minBtn ≥ 32`。

四项即可判**通过**，无需再做视觉主观调整。
