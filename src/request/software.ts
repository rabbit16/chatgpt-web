import request from '.'
import { userStore } from '@/store'
import type { SoftwareLink } from './api'

/**
 * 软件商城 · 统一数据契约（官方直传 + 用户投稿审核）
 * ------------------------------------------------------------
 * 设计要点：
 *   1. 商城公开列表只认「已上架」：status=1 且 review_status=approved。
 *      官方软件由管理员在后台直传，服务端写 review_status=approved，所以天生就是已上架。
 *   2. 用户投稿一律 source=user、review_status=pending、status=0，必须后台审核通过才公开。
 *   3. 所有接口都可能「还没上线」——本模块把它们统一包成带 ok/local 的返回，
 *      页面据此进入「本地模式」（localStorage 暂存），绝不静默失败、也不编造假数据。
 *
 * 返回体沿用站内约定：{ code: 0, data: {...}, message: 'ok' }，
 * 错误时 code != 0（或请求直接抛错），本文统一判定为「接口不可用」。
 */

export type SoftwarePlatform = 'windows' | 'macos' | 'linux'

/** 官方=管理员直传，user=用户投稿（community） */
export type SoftwareSource = 'official' | 'user'

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type SoftwareStatus = 0 | 1

/** 商城列表 / 详情共用的软件实体 */
export type SoftwareRecord = {
  id: number | string
  name: string
  summary: string
  category_id?: number
  category_name?: string
  cover_url?: string
  version?: string
  /** 单平台（旧字段）：老数据 / 后端过渡期只会给这一个 */
  platform?: SoftwarePlatform
  file_url?: string
  file_size?: number | string
  /**
   * 多平台（新字段）：一个软件可同时挂 Windows / macOS / Linux。
   * 2026-10-25 站长反馈「上传链接的话三个平台同时都能在一个链接下载」，
   * 所以列表要能显示多个平台图标、详情要能按平台各给一个下载入口。
   * 兼容策略：旧记录没有它时，页面用单数 platform/file_url 兜底（见 recordPlatforms）。
   */
  platforms?: PlatformEntry[]
  changelog?: string
  repo_url?: string
  source: SoftwareSource
  /**
   * 来源是否为前端推断（后端没返回 source 字段时为 true）
   * 只用于界面如实提示，不参与「全部/官方/用户」归类判断。
   */
  source_inferred?: boolean
  author_name?: string
  /** 官方软件 = approved；用户投稿初始 pending */
  review_status: ReviewStatus
  reviewer_note?: string
  reviewed_at?: string
  status: SoftwareStatus
  download_count?: number
  links?: SoftwareLink[]
  sort?: number
  insert_time?: string
  update_time?: string
}

/** 一条「某平台的安装包」：列表图标、详情下载行、后台表单都复用它 */
export type PlatformEntry = {
  platform: SoftwarePlatform
  file_url: string
  file_size?: number | string
  version?: string
  download_count?: number
}

/** 《SoftwarePlatformEntry》是 PlatformEntry 的规范别名（对外统一叫这个名字） */
export type SoftwarePlatformEntry = PlatformEntry

/** 用户投稿时每个平台一个安装包 */
export type SubmitPlatformEntry = {
  platform: SoftwarePlatform
  file_url: string
  file_size?: number | string
}

export type SubmitSoftwarePayload = {
  name: string
  summary: string
  category_id?: number
  version: string
  platforms: SubmitPlatformEntry[]
  changelog?: string
  repo_url?: string
}

/** 统一的操作结果：ok=写入成功；local=true 表示只写进了浏览器本地 */
export type ActionResult = { ok: boolean; local: boolean }

/** 列表结果：接口挂了就 local=true，页面顶部提示「本地模式」 */
export type ListResult<T> = { list: T[]; total: number; local: boolean }

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

const OFFICIAL_KEY = 'anygpt_market_official_local'
const SUBMISSION_KEY = 'anygpt_market_submissions_local'

/**
 * 登录态头：除公开列表外都要带
 * ------------------------------------------------------------
 * 2026-10-25 验收修正：两种 header 一起发。
 * 站内 request 封装（src/request/index.ts 的 interceptorsRequest）历来只补 `token: <token>`，
 * 而后端契约（docs/后端接口-软件商城.md 3.0 节）写的是 `Authorization: Bearer <token>`。
 * 两边实现先后不确定，所以同时带两种：后端认哪种都能通过登录校验，
 * 后端照文档实现后前端无需再改；即使后端只认 Authorization 也不会 401。
 */
function authHeaders(): Record<string, string> {
  const token = userStore.getState().token
  if (!token) return {}
  return {
    Authorization: `Bearer ${token}`,
    token
  }
}

/**
 * 文件上传头
 * ------------------------------------------------------------
 * 坑：站内 request 封装默认会给 POST 补上 Content-Type: application/json，
 * 那样 FormData 会被当成 JSON 字符串发出去，后端收不到文件。
 * 它唯独放行「Content-Type: multipart/form-data」这个字面量（然后删掉、交给浏览器自己带 boundary），
 * 所以这里必须显式写死这一行，不能省。
 */
function uploadHeaders(): Record<string, string> {
  return { ...authHeaders(), 'Content-Type': 'multipart/form-data' }
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 隐私模式写不进去就只在内存/界面提示，不影响主流程
  }
}

/** 判断一次调用是否真的成功：request 封装把 HTTP 错误也 resolve 成 code!=0 */
function isOk(res: any): boolean {
  if (!res) return false
  if (typeof res.code === 'number') return res.code === 0
  return Boolean(res?.data?.code === 0 || res?.data?.code === '0')
}

function toNumberId(id: number | string): number | string {
  return id
}

/** 本地模式下的 id 前缀，便于识别「这条只在本机」 */
export const LOCAL_ID_PREFIX = 'local-'

export function isLocalId(id: number | string): boolean {
  return String(id).startsWith(LOCAL_ID_PREFIX)
}

/** 文件大小可读化：字节 → KB/MB，列表与详情都用得上 */
export function formatFileSize(size?: number | string): string {
  if (size === undefined || size === null || size === '') return ''
  const bytes = typeof size === 'number' ? size : Number(size)
  if (!Number.isFinite(bytes) || bytes <= 0) return String(size)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export const PLATFORM_LABEL: Record<SoftwarePlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux'
}

export const SOURCE_LABEL: Record<SoftwareSource, string> = {
  official: '官方软件',
  user: '用户上传'
}

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回'
}

/* ------------------------------------------------------------------ */
/* 官方侧（管理员）                                                     */
/* ------------------------------------------------------------------ */

/**
 * 管理员上传文件（安装包 / 封面）
 * POST /user/admin/software/upload —— multipart：file + kind(package|cover)
 * 返回 data: { url, file_name, file_size }
 */
export async function adminUploadFile(
  file: File,
  kind: 'package' | 'cover'
): Promise<{ ok: boolean; local: boolean; url?: string; file_name?: string; file_size?: number }> {
  const form = new FormData()
  form.append('file', file)
  form.append('kind', kind)
  try {
    const res: any = await request.post('/user/admin/software/upload', form, uploadHeaders())
    if (!isOk(res)) return { ok: false, local: false }
    const data = res?.data || {}
    return {
      ok: true,
      local: false,
      url: data.url,
      file_name: data.file_name || file.name,
      file_size: Number(data.file_size || file.size)
    }
  } catch {
    return { ok: false, local: false }
  }
}

/**
 * 管理员直传新建：服务端强制 source=official、提交即上架
 * ------------------------------------------------------------
 * 2026-10-25 站长验收反馈：「平台只能单个选择，但我上传链接的话就是三个平台都能用」。
 * 因此新增 `platforms` 复数数组，一个软件可同时挂多个平台，每个平台各自一条链接。
 * `platform` 单数字段保留：只选一个平台时照旧下发，兼容后端「先按单平台实现」的过渡期。
 */
export type AdminCreateSoftwarePayload = {
  category_id: number
  name: string
  summary?: string
  cover_url?: string
  /** 单平台（兼容旧契约）：只选一个平台时下发 */
  platform?: SoftwarePlatform
  /** 多平台（新）：每个平台一条安装包地址 */
  platforms?: { platform: SoftwarePlatform; file_url: string; file_size?: number }[]
  version?: string
  /** 兼容旧契约：等于 platforms[0].file_url */
  file_url?: string
  file_size?: number
  changelog?: string
  links?: SoftwareLink[]
  status?: number
  sort?: number
}

/**
 * POST /user/admin/software/create
 * 管理员创建即上架：source=official、review_status=approved、status=1（服务端强制）
 */
export async function adminCreateSoftware(
  payload: AdminCreateSoftwarePayload
): Promise<ActionResult> {
  try {
    const res: any = await request.post(
      '/user/admin/software/create',
      {
        ...payload,
        source: 'official',
        review_status: 'approved',
        status: payload.status ?? 1
      },
      authHeaders()
    )
    if (isOk(res)) return { ok: true, local: false }
    return { ok: false, local: false }
  } catch {
    return { ok: false, local: false }
  }
}

/** 管理员编辑：字段同上 + is_delete */
export type AdminUpdateSoftwarePayload = Partial<AdminCreateSoftwarePayload> & {
  id: number
  is_delete?: boolean
}

/** POST /user/admin/software/update */
export async function adminUpdateSoftware(payload: AdminUpdateSoftwarePayload): Promise<ActionResult> {
  try {
    const res: any = await request.post('/user/admin/software/update', payload, authHeaders())
    if (isOk(res)) return { ok: true, local: false }
    return { ok: false, local: false }
  } catch {
    return { ok: false, local: false }
  }
}

/* ------------------------------------------------------------------ */
/* 商城公开侧                                                          */
/* ------------------------------------------------------------------ */

/** 后端 /user/software/list 允许的最大 page_num（实测 >50 直接 422） */
export const MARKET_PAGE_MAX = 50

/**
 * 商城分类（第二排筛选栏的数据源）
 * 字段与 /user/software/category/list 实测返回一致；
 * status=1 且 is_delete=false 才该出现在商城。
 */
export type SoftwareCategoryRecord = {
  id: number
  name: string
  /** 排序，小的在前（后端返回的顺序不保证已按它排） */
  sort?: number
  /** 1=启用，0=停用 */
  status?: number
  is_delete?: boolean
  insert_time?: string
  update_time?: string
}

/**
 * 商城分类列表（第二排筛选栏用）
 * ------------------------------------------------------------
 * 为什么不复用 @/request/api 的 getSoftwareCategories：
 * 那个函数走站内 request 封装，而封装在拿到 code!==0 时会**弹全局红色「错误」通知**
 * （见 src/request/index.ts 的 interceptorsResponse）。
 * 分类栏是「增强功能」：站长后台把分类接口搞挂、或分类功能临时不可用时，
 * 商城主体（列表/下载/上传）必须照常工作，绝不能因为分类拉不到就弹一个红框吓用户。
 * 2026-10-25 实测过：直接复用会在分类接口返错时弹出「错误 模拟分类接口挂了」。
 *
 * 所以这里自己发 fetch，不走那套通知逻辑：
 *   · 成功 → 把顶层 list 规整成数组返回（null 表示「没拿到」而不是空分类）
 *   · 失败 → 返回 null，调用方据此隐藏分类栏，不报错、不弹窗、不影响其它请求
 *
 * 返回体是**顶层 list、没有 data 包裹**：
 *   {"code":"0","codeMsg":"成功","list":[...]} —— code 还是字符串 "0"，两种都认。
 */
export async function getMarketCategories(): Promise<SoftwareCategoryRecord[] | null> {
  try {
    const base = import.meta.env.VITE_APP_REQUEST_HOST
    const res = await fetch(`${base}/user/software/category/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        token: userStore.getState().token
      },
      body: JSON.stringify({ page: 1, page_num: 100 })
    })
    if (!res.ok) return null
    const body: any = await res.json()
    // code 可能是数字 0 或字符串 "0"；非 0 一律当失败
    if (body?.code !== undefined && String(body.code) !== '0') return null
    const rows = body?.list ?? body?.data?.list ?? body?.data
    if (!Array.isArray(rows)) return null
    return rows as SoftwareCategoryRecord[]
  } catch {
    // 网络异常：静默失败，分类栏不显示即可
    return null
  }
}

export type MarketListParams = {
  source?: SoftwareSource
  keyword?: string
  page?: number
  page_num?: number
  /**
   * 分类 id（2026-10-25 新增）
   * ------------------------------------------------------------
   * 后端 /user/software/list 支持按分类过滤（实测 category_id=1 只回 AI 类 3 条、
   * category_id=3 只回效率软件 1 条），所以这一层能力后端已就绪，前端只需透传。
   *
   * 注意：商城第二排分类筛选**当前走的是本地过滤**（见 pages/projects/index.tsx），
   * 不依赖这个参数；这里补上是为了让函数签名与后端契约一致，
   * 将来分类数据量大了要改成服务端分页过滤时，直接传这个字段即可。
   */
  category_id?: number
}

/**
 * 商城公开列表
 * POST /user/software/list —— source 可选 official|user、keyword
 * 服务端只返回 status=1 且 review_status=approved 的记录。
 *
 * 接口不可用时返回「本机官方直传暂存 + 已通过的用户投稿」，并标 local=true。
 */
export async function getMarketList(params: MarketListParams = {}): Promise<ListResult<SoftwareRecord>> {
  try {
    const res: any = await request.post(
      '/user/software/list',
      {
        source: params.source || undefined,
        keyword: params.keyword || '',
        /**
         * category_id：不传时发 null（与 request/api.ts 的 getSoftwareList 保持一致）。
         * 为什么发 null 而不发 undefined：undefined 会被 JSON.stringify 直接丢掉，
         * 字段在 body 里消失；发 null 是「显式不过滤」，后端两种都认，但契约更清楚。
         */
        category_id: params.category_id ?? null,
        page: params.page || 1,
        /**
         * 2026-10-25 实测踩到的坑：后端把 page_num 限制在 **≤50**（Pydantic 校验），
         * 传 100 会返回 422 {"detail":[{"type":"less_than_equal",...}]}，code 不存在。
         * isOk() 判为失败 → 整个商城进「本地模式」、列表空白。
         * 页面以为接口挂了，其实只是页码要太多。
         * 所以这里统一夹到 50：调用方写多大都不会把商城搞空。
         */
        page_num: Math.min(Number(params.page_num) || 50, MARKET_PAGE_MAX)
      },
      authHeaders()
    )
    if (!isOk(res)) throw new Error('list failed')
    const payload = res?.data || {}
    const list = (payload.list || payload.data || []) as SoftwareRecord[]
    if (!Array.isArray(list)) throw new Error('list malformed')
    // 后端若漏字段，这里补默认值，避免页面出现 undefined 徽标
    const normalized = list.map(normalizeRecord)
    return { list: normalized, total: Number(payload.total || normalized.length), local: false }
  } catch {
    const local = readLocal<SoftwareRecord[]>(OFFICIAL_KEY, []).concat(
      readLocal<SoftwareRecord[]>(SUBMISSION_KEY, []).filter((item) => item.review_status === 'approved')
    )
    const filtered = local
      .filter((item) => (params.source ? item.source === params.source : true))
      .filter((item) =>
        params.keyword
          ? `${item.name} ${item.summary}`.toLowerCase().includes(params.keyword.toLowerCase())
          : true
      )
      // 分类过滤在「本地模式」下也照做，否则降级后行为与线上不一致
      .filter((item) =>
        params.category_id ? Number(item.category_id) === Number(params.category_id) : true
      )
      .map(normalizeRecord)
    return { list: filtered, total: filtered.length, local: true }
  }
}

/**
 * 商城详情
 * GET /user/software/detail?id=
 * 后端未提供时降级：从 public 列表里找同 id 的记录（页面层面已经这么做了，
 * 这里同样兜一层，避免详情页白屏）。
 */
export async function getMarketDetail(id: number | string): Promise<{ item?: SoftwareRecord; local: boolean }> {
  try {
    const res: any = await request.get('/user/software/detail', { id }, authHeaders())
    if (!isOk(res)) throw new Error('detail failed')
    const data = res?.data || {}
    const item = (data.item || data) as SoftwareRecord
    if (!item || !item.id) throw new Error('detail malformed')
    return { item: normalizeRecord(item), local: false }
  } catch {
    // 降级顺序：公开列表 → 我的提交 → 本机暂存
    // 为什么还要查「我的提交」：待审核/已驳回的投稿不在公开列表里，
    // 但作者本人点进去应该能看到状态和驳回原因，否则会误以为项目丢了。
    const res = await getMarketList({ page_num: 200 })
    const hit = res.list.find((item) => String(item.id) === String(id))
    if (hit) return { item: hit, local: res.local }

    const mine = await getMySubmissions()
    const mineHit = mine.list.find((item) => String(item.id) === String(id))
    if (mineHit) return { item: mineHit, local: mine.local }

    const officialLocal = readLocal<SoftwareRecord[]>(OFFICIAL_KEY, [])
    const localHit = officialLocal.find((item) => String(item.id) === String(id))
    return { item: localHit ? normalizeRecord(localHit) : undefined, local: true }
  }
}

/**
 * 判断一条记录「是不是官方直传」
 * ------------------------------------------------------------
 * 2026-10-25 站长报的 bug：商城「官方软件」页签永远是空的，
 * 站长自己后台传的软件（余额兔）全跑到「用户上传」里去了。
 *
 * 排查结论（线上接口实测）：`/user/software/list` 返回的字段全集只有
 *   category_id / category_name / cover_url / id / insert_time / is_delete /
 *   links / name / sort / status / summary / update_time / version
 * 即：**没有 source、没有 review_status、没有 official 标记、也没有投稿人字段**。
 * 所以「官方 vs 用户」在后端当前数据里根本无据可判 —— 不是猜不到，是数据里没这个信息。
 *
 * 判据（按可信度从高到低，命中任一即官方）：
 *   1. source === 'official'                 —— 后端按契约补字段后，这是正解；
 *   2. official === true / is_official === 1 —— 其他常见后端命名习惯，一并兼容；
 *   3. author_name === '站长'                —— 后台直传时前端本地暂存就是写这个名字；
 *   4. 完全没有 source 字段时               —— **默认归官方**（关键决策，理由见下）。
 *
 * 为什么「缺字段」默认是官方，而不是用户投稿：
 *   · 现存记录全部是站长本人在后台手录的（claude-haha、codex、claudecode、余额兔），
 *     它们在业务上**本来就是官方软件**；
 *   · 默认成 user 会造成双向错误：官方页签空着 + 站长自己的软件混进「用户上传」，
 *     正是站长这次看到的 bug；
 *   · 用户投稿在契约里是 source=user 且 review_status=pending，后端一旦实现就会带字段，
 *     那时会自动走判据 1，前端不用再改。
 * 唯一要防的误判：真实用户投稿若后端漏了 source，会被当成官方。
 * 所以判据 5 保留了「有投稿人字段 → 归用户」这条反向兜底，见下方 isUserSubmission()。
 */
const OFFICIAL_HINTS = [
  (raw: any) => raw?.source === 'official',
  (raw: any) => raw?.official === true,
  (raw: any) => raw?.is_official === 1 || raw?.is_official === true,
  (raw: any) => raw?.author_name === '站长'
]

/** 明确指向「用户投稿」的信号：投稿人字段存在，且不是站长本人 */
function looksLikeUserSubmission(raw: any): boolean {
  if (raw?.source === 'user') return true
  const author = raw?.author_name || raw?.submitter_name || raw?.user_name
  if (author && author !== '站长') return true
  return false
}

/**
 * 定 source：先看官方信号，再看投稿信号，都没有就按「官方」兜底。
 * 顺序很关键 —— 官方信号优先，避免后端同时给了 is_official=1 和一个作者名时被判成用户。
 *
 * 第二个返回值表示「这个来源是前端推断的，不是后端给的」。
 * 界面据此可以说实话（见 projects/index.tsx 的来源说明），
 * 而不是让站长以为官方/用户已经分得很准。
 */
function resolveSource(raw: any): { source: SoftwareSource; inferred: boolean } {
  if (OFFICIAL_HINTS.some((hit) => hit(raw))) return { source: 'official', inferred: false }
  if (looksLikeUserSubmission(raw)) return { source: 'user', inferred: false }
  // 到这里说明后端没给任何来源信息：按站长全部手录的现实，归官方（理由见上）
  return { source: 'official', inferred: true }
}

/** 后端字段缺失时补默认值，保证 UI 永远有东西可渲染 */
function normalizeRecord(raw: SoftwareRecord): SoftwareRecord {
  const { source, inferred } = resolveSource(raw)
  return {
    ...raw,
    source,
    /** 来源是否为前端推断（后端未返回 source 时为 true），供界面诚实提示 */
    source_inferred: inferred,
    /**
     * review_status 的优先级：**后端给了就听后端的**，没给才按 source 推。
     * 为什么要强调这个顺序：真实用户投稿在后端是 pending，
     * 如果我们先按 source 推、再被后端的值覆盖成 approved，
     * 待审内容就会提前出现在公开列表里；反过来若直接用 source 推，
     * 后端给的 rejected 会被吞掉。两种都不能接受，所以必须「后端优先」。
     */
    review_status: raw.review_status || (source === 'official' ? 'approved' : 'pending'),
    status: typeof raw.status === 'number' ? raw.status : 1,
    // 多平台数组只保留合法项，避免脏数据让页面渲染出空图标
    platforms: normalizePlatforms(raw.platforms)
  }
}

/** 平台枚举白名单：后端/旧数据可能给出杂七杂八的值，这里统一过滤 */
const PLATFORM_SET: SoftwarePlatform[] = ['windows', 'macos', 'linux']

function isPlatform(value: unknown): value is SoftwarePlatform {
  return typeof value === 'string' && (PLATFORM_SET as string[]).includes(value)
}

/**
 * 把接口/本地存储里的 platforms 收拾干净
 * ------------------------------------------------------------
 * 容错点：
 *   · 不是数组（老数据没有这个字段）→ 返回 undefined，交给 recordPlatforms 用单数兜底；
 *   · 数组里有非法 platform 或空 url → 丢掉这一条，不让界面出现「空平台行」；
 *   · 同一平台重复上报 → 只留第一条，避免详情页出现两个 Windows 下载行。
 */
function normalizePlatforms(raw?: PlatformEntry[] | null): PlatformEntry[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined
  const seen = new Set<SoftwarePlatform>()
  const cleaned: PlatformEntry[] = []
  raw.forEach((entry) => {
    if (!entry || !isPlatform(entry.platform)) return
    if (seen.has(entry.platform)) return
    seen.add(entry.platform)
    cleaned.push({
      platform: entry.platform,
      file_url: typeof entry.file_url === 'string' ? entry.file_url : '',
      file_size: entry.file_size
    })
  })
  return cleaned.length ? cleaned : undefined
}

/**
 * 取一条记录实际有下载入口的平台列表（新字段优先，旧字段兜底）
 * ------------------------------------------------------------
 * 为什么要这个函数：库里既有「只有 platform + file_url」的老记录，
 * 也有这次新写入的 platforms 数组。前台列表/详情、本地模式都不能因此报错或漏平台，
 * 所以统一走这里拿数组，页面只认「数组」这一种形态。
 */
export function platformsOf(record: SoftwareRecord): SoftwarePlatformEntry[] {
  // 1) 新契约：后端已按多平台返回，直接用（normalizeRecord 已清洗过非法项）
  if (record.platforms?.length) return record.platforms
  // 2) 旧契约兜底：只有一个 platform + file_url，包装成单元素数组
  if (record.platform) {
    return [
      { platform: record.platform, file_url: record.file_url || '', file_size: record.file_size }
    ]
  }
  /**
   * 3) **线上现状兜底（2026-10-25 站长验收时发现）**：后端只返回 `links` 数组，
   *    形如 `[{label:'Windows',url:'https://...',code:''}, {label:'macOS',...}, {label:'Linux',...}]`，
   *    既没有 `platforms` 也没有单数 `platform`。
   *    原来这里读不到任何平台，详情页三个平台全显示「尚未上传」，
   *    可数据库里明明有三条链接 —— 用户会以为软件没得下。
   *    `label` 是中文/英文平台名，转成枚举即可。识别不出的 label（如「百度网盘」）不丢，
   *    它更像「渠道名」而不是平台，交给下面的 links 通用兜底。
   */
  if (Array.isArray(record.links) && record.links.length) {
    const fromLinks: SoftwarePlatformEntry[] = []
    const seen = new Set<SoftwarePlatform>()
    for (const link of record.links) {
      const platform = platformFromLabel(link?.label)
      const url = typeof link?.url === 'string' ? link.url.trim() : ''
      if (!platform || !url || seen.has(platform)) continue
      seen.add(platform)
      fromLinks.push({ platform, file_url: url })
    }
    if (fromLinks.length) return fromLinks
  }
  // 4) 再兜一层：有安装包地址但平台未知（老后台没填平台），按 Windows 给出下载入口，
  //    否则用户点进详情会看到「待上传」却明明有包，比标错平台更糟。
  if (record.file_url) {
    return [{ platform: 'windows', file_url: record.file_url, file_size: record.file_size }]
  }
  // 5) 什么都没有：返回空数组，页面据此显示「安装包待上传」
  return []
}

/**
 * 把链接条目的 `label`（可能是「Windows」「macOS」「苹果」「Linux」「Windows 版」等）
 * 归一成平台枚举；认不出来返回 null。
 * 单独抽出来是因为 `links[].label` 是自由文本，写死等值判断很容易漏掉写法差异。
 */
export function platformFromLabel(label?: string): SoftwarePlatform | null {
  const text = (label || '').toLowerCase()
  if (!text) return null
  if (/win|exe|微软/.test(text)) return 'windows'
  if (/mac|osx|dmg|苹果|darwin/.test(text)) return 'macos'
  if (/linux|deb|rpm|appimage|ubuntu/.test(text)) return 'linux'
  return null
}

/** @deprecated 用 platformsOf()；保留旧名仅为兼容既有注释/调用 */
export const recordPlatforms = platformsOf

/* ------------------------------------------------------------------ */
/* 用户侧                                                              */
/* ------------------------------------------------------------------ */

/**
 * 用户上传安装包（需登录）
 * POST /user/software/upload —— multipart，返回 { url }
 * 后端可能不实现；前端必须兼容「只填网盘链接」的路径，所以失败不阻断提交。
 */
export async function uploadUserPackage(
  file: File
): Promise<{ ok: boolean; url?: string; file_size?: number }> {
  const form = new FormData()
  form.append('file', file)
  form.append('kind', 'package')
  try {
    const res: any = await request.post('/user/software/upload', form, uploadHeaders())
    if (!isOk(res)) return { ok: false }
    const data = res?.data || {}
    return { ok: true, url: data.url, file_size: Number(data.file_size || file.size) }
  } catch {
    return { ok: false }
  }
}

/**
 * 用户投稿
 * POST /user/software/submit
 * 服务端写 source='user'、review_status='pending'、status=0，返回 { id }
 * 接口不可用 → 写 localStorage，标「待审核（本地暂存）」。
 */
export async function submitSoftware(payload: SubmitSoftwarePayload): Promise<ActionResult> {
  try {
    const res: any = await request.post('/user/software/submit', payload, authHeaders())
    if (isOk(res)) return { ok: true, local: false }
    throw new Error('submit failed')
  } catch {
    const list = readLocal<SoftwareRecord[]>(SUBMISSION_KEY, [])
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const primary = payload.platforms[0]
    const record: SoftwareRecord = {
      id: `${LOCAL_ID_PREFIX}${Date.now()}`,
      name: payload.name,
      summary: payload.summary,
      category_id: payload.category_id,
      version: payload.version,
      // 本地也存多平台数组，避免刷新后只剩第一个平台的下载入口
      platforms: normalizePlatforms(
        payload.platforms.map((item) => ({
          platform: item.platform,
          file_url: item.file_url,
          file_size: typeof item.file_size === 'number' ? item.file_size : Number(item.file_size) || undefined
        }))
      ),
      platform: primary?.platform,
      file_url: primary?.file_url,
      file_size: primary?.file_size,
      changelog: payload.changelog,
      repo_url: payload.repo_url,
      source: 'user',
      author_name: '我',
      review_status: 'pending',
      status: 0,
      insert_time: now,
      update_time: now
    }
    writeLocal(SUBMISSION_KEY, [record, ...list])
    return { ok: true, local: true }
  }
}

/**
 * 我的提交
 * GET /user/software/my-submissions —— 含 review_status、reviewer_note、reviewed_at
 * 接口不可用时读本地暂存（含本机审核结果），标 local=true。
 */
export async function getMySubmissions(): Promise<ListResult<SoftwareRecord>> {
  try {
    const res: any = await request.get('/user/software/my-submissions', undefined, authHeaders())
    if (!isOk(res)) throw new Error('mine failed')
    const payload = res?.data || {}
    const list = (payload.list || payload.data || []) as SoftwareRecord[]
    if (!Array.isArray(list)) throw new Error('mine malformed')
    const localOnly = readLocal<SoftwareRecord[]>(SUBMISSION_KEY, []).filter(isLocalRecord)
    return {
      list: [...localOnly, ...list.map(normalizeRecord)],
      total: Number(payload.total || list.length),
      local: false
    }
  } catch {
    const list = readLocal<SoftwareRecord[]>(SUBMISSION_KEY, []).map(normalizeRecord)
    return { list, total: list.length, local: true }
  }
}

function isLocalRecord(item: SoftwareRecord) {
  return isLocalId(item.id)
}

/* ------------------------------------------------------------------ */
/* 后台审核侧（管理员）                                                 */
/* ------------------------------------------------------------------ */

/**
 * 待审队列（source=user）
 * GET /user/admin/software/review/list?status=pending&page=1&page_num=10
 * 接口不可用 → 读本地暂存投稿，标 local=true，方便本地把流程走通。
 */
export async function getReviewList(params: {
  status?: ReviewStatus | 'all'
  page?: number
  page_num?: number
}): Promise<ListResult<SoftwareRecord>> {
  try {
    const res: any = await request.get(
      '/user/admin/software/review/list',
      {
        status: params.status && params.status !== 'all' ? params.status : undefined,
        page: params.page || 1,
        page_num: params.page_num || 10
      },
      authHeaders()
    )
    if (!isOk(res)) throw new Error('review list failed')
    const payload = res?.data || {}
    const list = (payload.list || payload.data || []) as SoftwareRecord[]
    if (!Array.isArray(list)) throw new Error('review list malformed')
    // 本机还没同步的投稿也带上，避免管理员看不到刚测的那条
    const localOnly = readLocal<SoftwareRecord[]>(SUBMISSION_KEY, []).filter(isLocalRecord)
    const merged = [...localOnly, ...list.map(normalizeRecord)]
    const filtered =
      params.status && params.status !== 'all'
        ? merged.filter((item) => item.review_status === params.status)
        : merged
    return { list: filtered, total: Number(payload.total || filtered.length), local: false }
  } catch {
    const all = readLocal<SoftwareRecord[]>(SUBMISSION_KEY, []).map(normalizeRecord)
    const filtered =
      params.status && params.status !== 'all'
        ? all.filter((item) => item.review_status === params.status)
        : all
    return { list: filtered, total: filtered.length, local: true }
  }
}

/**
 * 审核：通过 / 驳回
 * POST /user/admin/software/review  { id, action: 'approve'|'reject', note }
 * approve → review_status=approved、status=1
 * reject  → review_status=rejected、status=0，note 必填
 *
 * 本机暂存的记录直接改 localStorage，返回 local=true，页面照常提示。
 */
export async function reviewSoftware(params: {
  id: number | string
  action: 'approve' | 'reject'
  note?: string
}): Promise<ActionResult> {
  if (isLocalId(params.id)) {
    return { ok: applyLocalReview(params), local: true }
  }
  try {
    const res: any = await request.post(
      '/user/admin/software/review',
      {
        id: params.id,
        action: params.action,
        note: params.note || ''
      },
      authHeaders()
    )
    if (isOk(res)) return { ok: true, local: false }
    return { ok: false, local: false }
  } catch {
    return { ok: false, local: false }
  }
}

/** 本地模式下改状态：写入本机，用户「我的提交」立刻能看到结果 */
function applyLocalReview(params: {
  id: number | string
  action: 'approve' | 'reject'
  note?: string
}): boolean {
  const list = readLocal<SoftwareRecord[]>(SUBMISSION_KEY, [])
  const index = list.findIndex((item) => String(item.id) === String(params.id))
  if (index < 0) return false
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const next = [...list]
  next[index] = {
    ...next[index],
    review_status: params.action === 'approve' ? 'approved' : 'rejected',
    status: params.action === 'approve' ? 1 : 0,
    reviewer_note: params.action === 'reject' ? params.note || '' : '',
    reviewed_at: now,
    update_time: now
  }
  writeLocal(SUBMISSION_KEY, next)
  // 通过后不用另存一份：公开列表本地兜底时会自动把 approved 的用户投稿并进去
  return true
}

/**
 * 官方直传在本地模式下暂存：让管理员不连后端也能看到自己刚传的软件
 * ------------------------------------------------------------
 * 2026-10-25 多平台：本地记录也必须带 `platforms`。
 * 只在调用方拼字段是不够的——漏一处，本地模式下商城就只看得到一个平台图标。
 * 所以这里统一做一次归一化：传进来只有单数 platform 的老式对象，也补成数组；
 * 反过来，复数数组若只有一个平台，同样回填单数，方便还没升级的旧页面读。
 */
export async function saveOfficialLocally(record: SoftwareRecord): Promise<ActionResult> {
  const list = readLocal<SoftwareRecord[]>(OFFICIAL_KEY, [])
  const entries = platformsOf(record)
  const normalized: SoftwareRecord = {
    ...record,
    platforms: entries.length ? entries : undefined,
    // 只有单平台时才写单数字段：多平台写了会被旧页面误读成「只有一个平台」
    ...(entries.length === 1
      ? {
          platform: entries[0].platform,
          file_url: entries[0].file_url,
          file_size: entries[0].file_size
        }
      : {})
  }
  writeLocal(OFFICIAL_KEY, [normalized, ...list])
  return { ok: true, local: true }
}

/** 本地模式清理：真接上后端后可一键清干净，避免脏数据混进界面 */
export function clearLocalMarketData() {
  ;[OFFICIAL_KEY, SUBMISSION_KEY].forEach((key) => {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  })
}

export { toNumberId }
