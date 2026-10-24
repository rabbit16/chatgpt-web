# 手机端 UI 审查报告（390 / 375 / 414）

- 日期：2026-10-24
- 分支：`feature/dev`（只读审查，未改任何业务代码）
- 环境：`vite` dev @ `http://127.0.0.1:5173`，ego-browser 390×844 / 375×844 / 414×844，DPR 2，touch 模拟开启
- 账号：管理员测试账号（可看 `/admin/*`）
- 截图：`docs/audit/2026-10-24/mobile/`

## 结论（先看这段）

用户说的「拖到边上也看不到价格」**不是错觉，是必然结果**：

| 宽度 | 表格可视区 | 固定「模型」列 | 固定列占比 |
|---|---|---|---|
| 375 | 205px | 292px | **143%** |
| 390 | 220px | 292px | **133%** |
| 414 | 244px | 292px | **120%** |

固定列本身比整个可视区还宽，横向滚动**无论拖到哪一端都没有一列能完整露出**。实测拖到最右（`scrollLeft=955/960`）后，屏幕只剩「模型」列，价格列全部被压在固定列下面。

另一个隐藏原因：内容区两侧各有 40px 内边距（ProLayout 默认）+ 页面自身 24px，390 屏上真正可用宽度只剩 **262px**，等于白扔了 80px。

---

# 一、必须改（5 条）

## M1. `/price` 价格表：固定列吃掉整个可视区，拖到最右也看不到价格

- **触发页面**：`/price`（「完整价目」表 + 「图像模型」表）
- **现象**：390 下表格只剩「模型」一列；「模式/输入/缓存读取/缓存写入/输出/长上下文」全部不可见。拖到最右仍只有「模型」列；左端还多出约 52px 空白。
- **实测**：
  - 390：`scrollWidth=1180`，`clientWidth=220`，`max=960`
  - 拖到最右后：`模型` 列占 `18→310px`，`长上下文` 被压在 `122→310px`，`输出` 被推到 `-3→122px`（几乎全遮）
  - 固定列 `th { position: sticky; left: 52.21px }`，滚动 400px 后 `thLeft` 不变 → 左侧 52px 空洞，表头错位
  - 完整落在可视区的列数 = **0**
- **根因**（三个叠加）：
  1. `src/pages/price/index.tsx:290` 固定列 `fixed: 'left'` + `:289` `width: 280`，而可视区只有 220px
  2. `src/pages/price/index.tsx:580` `scroll={{ x: 1180 }}`：1180 是桌面总宽，没有为窄屏压缩
  3. 表头/表体在 `ant-table-content` 内，sticky 偏移被 antd 按桌面算成 52px（展开列宽），窄屏下形成空洞
- **最小改法**（不动业务逻辑，只动列定义与样式）：

  `src/pages/price/index.tsx:285` 起，把列宽改为响应式（先取 `isMobile`）：

  ```tsx
  // 文件顶部
  function useIsNarrow(breakpoint = 768) {
    const [narrow, setNarrow] = useState(
      typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
    )
    useEffect(() => {
      const onResize = () => setNarrow(window.innerWidth <= breakpoint)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [breakpoint])
    return narrow
  }

  // PricePage 内
  const narrow = useIsNarrow()
  ```

  ```tsx
  // 原 :289-290
  title: '模型', dataIndex: 'name', width: 280, fixed: 'left' as const,
  // 改为（窄屏不固定、收窄）
  title: '模型', dataIndex: 'name', width: narrow ? 168 : 280,
  fixed: narrow ? undefined : ('left' as const),

  // 原 :580
  scroll={{ x: narrow ? 900 : 1180 }}
  ```

  「图像模型」表同理：`:613` `scroll={{ x: 980 }}` → `narrow ? 760 : 980`，并给该表「模型」列补 `width: narrow ? 168 : undefined`。

- **验证方式**：
  1. 390 下打开 `/price`，横向拖到最右 →「输出」「长上下文」两列能完整露出数字
  2. Console 里跑
     ```js
     const el = document.querySelector('.ant-table-content')
     el.scrollWidth - el.clientWidth
     ```
     并 `el.scrollLeft = el.scrollWidth`，用
     ```js
     [...document.querySelectorAll('.ant-table-thead th')]
       .every(th => { const r = th.getBoundingClientRect(); const c = el.getBoundingClientRect()
         return r.left >= c.left - 1 && r.right <= c.right + 1 })
     ```
     检查可见列数 > 0
  3. 375 / 414 各再验一次

- **附带问题：表头不跟随纵向滚动**。价格表未设 `scroll.y`，`.ant-table-content` 高 2010px，表头只在表格顶部出现一次；390 下表格总高 2372px，滚到第 5 行后就不知道每列是什么（横向还在滚动，更容易迷失）。
  **改法**（与 M1 同一处）：
  ```tsx
  // src/pages/price/index.tsx:580
  scroll={{ x: narrow ? 900 : 1180, y: narrow ? 420 : undefined }}
  ```
  设了 `y` 后 rc-table 走 `fixHeader` 分支（`rc-table/es/Table.js:227`），表头独立成 `.ant-table-header` 并固定，横向滚动由内部统一驱动、表头表体保持同步。
  **验证**：390 下滚到表格中段，表头仍停在表格顶部可见；横向拖到最右时表头与表体列仍对齐。

> 注：这是**必须改**里唯一需要动 tsx 的一条；如果只想先动样式止血，可先做 M2（把可用宽度从 262 提到 342），至少能让「模型 + 模式」两列露出来，再排期改列宽。

---

## M2. 全站内容区两侧 40px 内边距：390 屏白扔 80px

- **触发页面**：全站 7 页 + 后台（`/`、`/price`、`/usage`、`/price?tab=invoice`、`/chat`、`/guide`、`/notice`、`/admin/*`）
- **现象**：手机左右留白明显偏大；`/` 首屏 hero 卡左右不对称（左 40px、右贴边）；表格可用宽度被进一步压缩。
- **实测**：390 下 `main.ant-pro-layout-content { padding: 0px 40px }`（后台是 `24px 40px`），`.wrap` 再叠 `padding: 0 24px` → 内容宽 `262px`（理论 342px）。
- **根因**：`src/components/Layout/index.tsx:54-66` 的 `ProLayout` 未覆盖 `layoutToken.pageContainer.paddingInlinePageContainerContent`，用框架默认 40；各页面 `.wrap`（如 `src/pages/price/index.module.less:15`）又写了 24px。
- **最小改法**（一处改完全站）：

  `src/components/Layout/index.tsx:66` 之后加：

  ```tsx
  token={{
    pageContainer: {
      paddingInlinePageContainerContent: 16,
      paddingBlockPageContainerContent: 12
    }
  }}
  ```

  并把页面级 `.wrap` 的横向内边距在窄屏归零，避免双重叠加。以价格页为例，`src/pages/price/index.module.less:15` 下方追加：

  ```less
  @media (max-width: 640px) {
    padding: 12px 0 32px;
  }
  ```

  `/usage`（`src/pages/usage/index.module.less:21`，现 `padding: 24px 16px 48px`）、`/guide`、`/notice`、`/`、`/chat` 同样处理：窄屏横向 padding 置 0。

- **验证方式**：390 下 Console 执行
  ```js
  getComputedStyle(document.querySelector('.ant-pro-layout-content')).padding
  document.querySelector('[class*="_wrap_"]').getBoundingClientRect().width
  ```
  期望 padding 含 `16px`、`.wrap` 宽 ≈ 390；再确认 `document.documentElement.scrollWidth === 390`（无横向溢出）。

---

## M3. `/price` 首屏：价格表要滚 1922px 才出现，首屏全被介绍内容占满

- **触发页面**：`/price`（tab=price）
- **现象**：390×844 首屏里只有页签、充值条、标题、刷新按钮、计费构成卡，**表头都看不到**，更别说价格。
- **实测**（390）：
  | 区块 | top | 高度 |
  |---|---|---|
  | PillTabs | 76 | 38 |
  | 充值条 | 134 | 169 |
  | 标题块 | 341 | 135 |
  | 计费构成 | 496 | 238 |
  | 费用估算 | 755 | 918 |
  | **价格表** | **1922** | 2372 |

  首屏 844px 内 0 个价格数字。
- **根因**：
  - `src/pages/price/index.module.less:36` 充值条窄屏 `flex-direction: column` 后变 169px 高
  - `src/pages/price/index.module.less:101` 标题块窄屏竖排 + 按钮 `width:100%`，135px
  - `src/pages/price/index.tsx:447` 计费构成 3 个图标块在窄屏换行占 238px
  - 三块加 `gap: 20px`（`:18`）把表格推到 1922px
- **最小改法**（只压缩，不删内容）：
  1. 充值条窄屏改横向紧凑版：`src/pages/price/index.module.less:36`
     ```less
     @media (max-width: 640px) {
       flex-direction: row;
       align-items: center;
       gap: 10px;
       padding: 10px 12px;
       .rechargeLead p { display: none; }      // 次要说明窄屏收起
       .rechargeActions :global(.ant-btn) { width: auto; height: 40px; }
     }
     ```
  2. 计费构成窄屏改单行横滑或两列：`src/pages/price/index.tsx:447` 的 `section` 加类，配合
     ```less
     @media (max-width: 640px) {
       .moneyFlow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; }
       .moneyFlowItem { flex-direction: column; text-align: center; gap: 6px; }
       .moneyFlowFormula { display: none; }
     }
     ```
  3. 标题块窄屏把「刷新价格」收成图标按钮：`src/pages/price/index.module.less:101` 内 `.ant-btn { width: auto; }`
- **验证方式**：390 下首屏（不滚动）截图里应能看到「完整价目」标题与表头；`document.querySelector('.ant-table').getBoundingClientRect().top + scrollY` 期望 < 1100。

---

## M4. `/usage` 表格：1800px 宽表，390 下只完整露出「时间」一列，余额/扣费不可见

- **触发页面**：`/usage`
- **现象**：首屏表格只完整露出「时间」一列，「用户 ID」被切掉一半，时间戳还折成两行；金额、状态、模型全在屏幕外，且**没有固定列也没有可见滚动条提示**。
- **实测**：390 下表格容器 `left=69 / right=321 / clientWidth=252`，`scrollWidth=1800`，`max=1548`；「时间」列 178px 完整可见，「用户 ID」（247→341）右缘超出容器（321），不完全可见。
- **根因**：`src/pages/usage/index.tsx:325` `scroll={{ x: 1800 }}`；列宽写死（`:337` `时间 width:170`、`:343` `用户ID width:90`）；表格无 `fixed` 列。
- **最小改法**：
  ```tsx
  // :325
  scroll={{ x: narrow ? 900 : 1800 }}
  // 建议同时给时间列窄屏收窄、禁止换行
  // :337
  width: narrow ? 128 : 170,
  onCell: () => ({ style: { whiteSpace: 'nowrap' } })
  ```
  `narrow` 用 M1 里同一个 `useIsNarrow()` 钩子（放在 `src/hooks/` 更好，两页共用）。
- **验证方式**：390 下 `/usage` 表格可见列 ≥ 3，时间戳单行；拖到最右能看到「金额/扣费」列。

---

## M5. 可点区域普遍 < 44px（页签 32px、页头按钮 32/34px、提取码按钮 15px）

- **触发页面**：全站，最集中在 `/price`（53 个）、`/usage`（41 个）、`/guide`（26 个）
- **实测**（390，`height < 44` 的可点元素）：
  | 页面 | 可点总数 | <44px |
  |---|---|---|
  | `/` | 21 | 9 |
  | `/price` | 54 | **53** |
  | `/price?tab=invoice` | 17 | 16 |
  | `/usage` | 42 | **41** |
  | `/chat` | 11 | 9 |
  | `/guide` | 30 | 26 |
  | `/notice` | 5 | 4 |

  典型：PillTabs 32px、页头「后台」36px、套餐筛选 32px、「提取码 wxhe」按钮 **66×15px**、chat 开关 22px。
- **根因**：
  - `src/components/PillTabs/index.module.less:18` `.tab { padding: 7px 16px }` → 高 32
  - `src/pages/price/index.module.less:353` `.tabs button { padding: 6px 14px }` → 高 32
  - `src/components/HeaderRender/index.module.less:47` 图标按钮 `height: 32px`
  - `src/pages/guide/index.module.less` 提取码按钮无最小高度
- **最小改法**（统一加一条全局窄屏兜底，比逐页改省事）：

  `src/styles/global.less` 末尾追加：

  ```less
  /* 窄屏触控兜底：可见可点元素最小 44×44（WCAG 2.5.5） */
  @media (max-width: 768px) {
    button,
    [role='button'],
    a.ant-btn,
    .ant-btn,
    .ant-tabs-tab {
      min-height: 44px;
    }
    /* 纯文字链不强行撑高，只补左右热区 */
    a:not(.ant-btn) {
      padding-block: 4px;
    }
  }
  ```

  再单独修 `PillTabs`：`src/components/PillTabs/index.module.less:18` → `padding: 11px 16px;`（≈44px）。
- **验证方式**：390 下 Console
  ```js
  [...document.querySelectorAll('button,.ant-btn,[role=button]')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && r.height < 44 }).length
  ```
  期望明显下降（目标 0，弹层内小图标可豁免）。

---

# 二、建议改（4 条）

## S1. 小于 12px 的文字：guide 最严重（23 处 11.5px、17 处 11px、11 处 10.5px、4 处 10px）

- **触发页面**：`/guide`、`/`（首页代码块 11px）、`/chat`（时间戳 10.5px）、`/usage`（趋势轴 11px）
- **现象**：手机上这些字「糊成一片」，正是用户说的「很多东西看不清」。
- **根因**：多处硬编码小字号：
  - `src/pages/guide/index.module.less:172,182`（`10.5px`）、`:217,450`（`11px`）、`:309,634`（`11px`）、`:412,606`（`10.5px`）、`:431,560,655`（`11.5px`）、`:500`（`10px`）
  - `src/pages/home/index.module.less:563`（`10.5px`）、`:568`（`11px`）
  - `src/pages/chat/components/ChatMessage/index.module.less:42`（`10.5px`）
  - `src/pages/usage/index.module.less:219`（`.trendAxis { font-size: 11px }`）
- **最小改法**：把上述 `10/10.5/11/11.5px` 统一抬到 `12px`（保留 `--fs-12` token）。批量替换前先确认这几处都是「辅助信息」而非需要塞进固定宽度的标签：
  ```less
  // guide: 标签类可保留紧凑但抬到下限
  font-size: 12px;
  ```
  同时删掉 `opacity: 0.9`（`chat/components/ChatMessage/index.module.less:46`）以免二次降低对比度。
- **验证方式**：390 下
  ```js
  [...document.querySelectorAll('*')].filter(el => !el.children.length && el.textContent.trim()
    && parseFloat(getComputedStyle(el).fontSize) < 12).length
  ```
  目标 0。

---

## S2. 横向滚动条全站被隐藏，用户不知道表格能拖

- **触发页面**：`/price`、`/usage`、`/admin/*`
- **现象**：表格能滚，但屏幕上没有任何「还能往右」的视觉提示；用户以为内容就是这样。
- **实测**：`src/styles/global.less:38` `*::-webkit-scrollbar { display: none; }` 把滚动条全部隐藏。价格页的 `HorizontalDrag` 虽提供了滑块提示（见 S3），但滑块本体在 390 下只有 **93px 宽**（`y=1889`，表格顶 `y=1922`），拖动手感极短，且提示文字与滑块挤在一行 215px 内。
- **根因**：全局隐藏滚动条；`src/components/HorizontalDrag/index.module.less:14` `.scrollTrack { flex:1; min-width:0 }` 在窄屏被文字挤到 93px。
- **最小改法**：
  ```less
  // global.less:38 附近，改为只隐藏纵向、保留表格横向可见条
  *::-webkit-scrollbar { display: none; }
  .ant-table-content::-webkit-scrollbar,
  .ant-table-body::-webkit-scrollbar {
    display: block;
    height: 8px;
  }
  .ant-table-content::-webkit-scrollbar-thumb,
  .ant-table-body::-webkit-scrollbar-thumb {
    background: var(--text-5);
    border-radius: 999px;
  }
  ```
  并在 `src/components/HorizontalDrag/index.module.less:1` 加窄屏布局：
  ```less
  @media (max-width: 640px) {
    .scrollBar { flex-direction: column; align-items: stretch; gap: 6px; }
    .scrollTrack { width: 100%; }
  }
  ```
- **验证方式**：390 下表格底部能看到 8px 滚动条；拖动条滑块宽度 ≈ 容器宽。

---

## S3. 拖动提示文案「按住表格左右拖动」在窄屏语义与位置都不对

- **触发页面**：`/price`（两张表）、`/usage`
- **现象**：提示条在表格**正上方**、只有 13px 字；手机上不是「按住拖动」，而是「手指左右滑」；提示 `top=1885`、表格 `top=1922`，位置相邻，但一旦向下滚到表格中段，提示条就滚出视口——用户实际操作时看不到它。
- **实测**：提示文字宽 104px、`font-size: 13px`、颜色 `--text-4`；滑块 93×12。
- **根因**：`src/components/HorizontalDrag/index.tsx:96-99` 文案写死"按住表格左右拖动"，未区分触屏；`src/components/HorizontalDrag/index.module.less:5` `margin-bottom: 8px` 放在表格上方，滚动后不可见。
- **最小改法**（组件内一处）：
  ```tsx
  // index.tsx:98
  <span>{window.matchMedia('(pointer: coarse)').matches ? '左右滑动表格查看价格' : '按住表格左右拖动'}</span>
  ```
  并把提示条改为 sticky 贴在表格顶部：
  ```less
  .scrollBar {
    position: sticky;
    top: calc(var(--header-h) + 4px);
    z-index: 3;
    background: var(--surface);
  }
  ```
- **验证方式**：390 下向下滚到表格，提示条仍在视口顶部可见，文案为「左右滑动表格查看价格」。

---

## S4. 数字未等宽 + 金额卡两栏被拉太开（发票 ¥ 与数字脱节）

- **触发页面**：`/price?tab=invoice`（统计卡）、`/price`（价格列）、`/usage`（金额列）、`/admin/invoices`
- **现象**：发票「已开票 ¥0.00 / 还能开 ¥370.00」的 ¥ 在最左、数字被推到最右，中间大段空白；价格表数字列没对齐，扫读慢。
- **实测**（390，发票统计卡）：
  | 卡 | 宽 | 标签右边界 | 金额左边界 | 中缝 |
  |---|---|---|---|---|
  | 已开票 | 262 | 233 | 243 | 10 |
  | 审核中 | 262 | 233 | 243 | 10 |
  | 还能开 | 262 | 206 | 216 | 10 |

  栅格 `grid-template-columns: 1fr auto` 把 `b`（金额）推到第二列最右，视觉上 ¥ 与数字被拉开 150px 以上。
- **根因**：
  - `src/pages/invoice/index.module.less:78-84` / `:109-113` `grid-template-columns: 1fr auto`
  - `src/pages/price/index.module.less:401` `.usdOnly { font-size:14px; font-weight:600; white-space:nowrap }` 未加 `tabular-nums`
  - `src/pages/usage/index.module.less` 金额列同类问题
- **最小改法**：
  ```less
  // invoice/index.module.less:109 起
  .summaryCard {
    grid-template-columns: 1fr auto;
    column-gap: 8px;

    b { justify-self: end; font-variant-numeric: tabular-nums; }
  }
  // 窄屏：金额跟标签同一行左对齐，别撑到最右
  @media (max-width: 640px) {
    .summaryCard { grid-template-columns: auto auto; justify-content: space-between; }
  }
  ```
  ```less
  // price/index.module.less:401
  .usdOnly { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum'; }
  ```
- **验证方式**：390 下发票三张卡金额与标签同排、间距一致；价格表「输入/输出」列数字右对齐（`text-align: right`）。

---

# 三、后台 `/admin/invoices`（单独提示，未计入 10 条上限）

390 下问题比前台更重，建议同期处理（同属 M2 根因）：

- 顶部筛选条：搜索框被压到 **40px**（只剩图标），「全部状态」Select 高 **358px**（被拉成竖条）
- 右侧说明文字被挤成**竖排单字**（"一单一票：同一订单只能通过一张发票…"）
- 表格 `clientWidth=310` / `scrollWidth=1240`，表头只露 ID、用户、操作，且表头错位、底部滚动条被裁

根因：`src/pages/admin/invoices/index.tsx` 筛选区未换行 + ProLayout `padding: 24px 40px`。
最小改法：筛选容器加 `flex-wrap: wrap`，每个控件 `min-width: 140px`；说明文字块窄屏 `display:none` 或移到表格下方；表格同上（M1/M2）。

---

# 四、截图清单

`docs/audit/2026-10-24/mobile/`

| 文件 | 内容 |
|---|---|
| `home-390.png` / `home-390-full.png` | 首页首屏 / 整页 |
| `price-390.png` / `price-390-full.png` | 价格页首屏 / 整页 |
| `price-table-left-390.png` | **价格表左端**（只见模型列） |
| `price-table-right-390.png` | **价格表拖到最右**（仍只见模型列，核心证据） |
| `price-375.png` / `price-375-right.png` | 375 宽度对照 |
| `price-414.png` / `price-414-right.png` | 414 宽度对照 |
| `usage-390.png` / `usage-390-full.png` | 用量页 |
| `usage-table-390.png` | 用量表（只完整露出「时间」一列） |
| `invoice-390.png` / `invoice-390-full.png` | 我的发票 |
| `invoice-list-390.png` | 发票列表 |
| `chat-390.png` / `chat-390-full.png` | 对话页 |
| `guide-390.png` / `guide-390-full.png` | 接入指南（小字最密集） |
| `notice-390.png` / `notice-390-full.png` | 公告页 |

补充：`/admin/invoices` 390 截图在 `/tmp/admin-invoices-390.png`（临时文件，未纳入交付目录）。

---

# 五、复测清单（改完后逐条打勾）

- [ ] 390 / 375 / 414 三宽度，`document.documentElement.scrollWidth === innerWidth`（无整页横向溢出）
- [ ] `/price` 拖到最右，「输出」「长上下文」完整可见
- [ ] `/price` 首屏（不滚动）能看到表头
- [ ] `/usage` 表格可见列 ≥ 3，金额列可达
- [ ] 全站 `height < 44` 的可点元素 = 0
- [ ] 全站 `font-size < 12px` 的文字 = 0
- [ ] 发票统计卡金额与标签同行、间距一致
- [ ] 表格底部可见滚动条 / sticky 拖动提示
