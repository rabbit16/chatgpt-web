// MODEL_PRICES / MODEL_META：仅作「简介 / 展示名 / 厂商 / 推荐偏好」绑定。
// 真正展示哪些模型，一律以供应商价目 API 返回为准：有则展示，无则不展示。
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'zhipu' | 'xai' | 'other'
export type PriceTier = 'standard' | 'fast'

export interface ModelPrice {
  id: string
  name: string
  provider: ModelProvider
  inputUsd: number
  cachedInputUsd: number
  outputUsd: number
  fast?: { inputUsd: number; cachedInputUsd: number; outputUsd: number }
  recommend?: boolean
  /** 适用场景简介，帮助客户选型 */
  intro?: string
}

export const PRICING_CONFIG = {
  updatedAt: '2026-10-01',
  unit: '1M tokens'
}

const p = (
  id: string,
  name: string,
  provider: ModelProvider,
  inputUsd: number,
  outputUsd: number,
  cachedInputUsd: number,
  intro: string,
  fast?: ModelPrice['fast']
): ModelPrice => ({ id, name, provider, inputUsd, outputUsd, cachedInputUsd, intro, fast })

/** 可选元数据目录：不决定是否展示，只补充简介等；价格以供应商接口为准 */
export const MODEL_PRICES: ModelPrice[] = [
  p('gpt-6.1-astra', 'GPT-6.1 Astra', 'openai', 1.89, 9.45, 0.189, '6.1 旗舰推理，适合复杂规划、长链路 Agent、高难度代码与研究'),
  p('gpt-6.1-sol', 'GPT-6.1 Sol', 'openai', 0.356, 1.78, 0.0356, '6.1 主力均衡款，日常对话、写作、编程首选'),
  p('gpt-6.1-luna', 'GPT-6.1 Luna', 'openai', 0.0501, 0.251, 0.005, '6.1 低价高速版，适合批量摘要、简单问答、高频轻量请求'),
  p('gpt-6-astra', 'GPT-6 Astra', 'openai', 1.89, 9.45, 0.189, '旗舰最强推理，适合复杂规划、长链路 Agent、高难度代码与研究任务'),
  p('gpt-6-sol', 'GPT-6 Sol', 'openai', 0.356, 1.78, 0.0356, '新一代主力均衡款，日常对话、写作、编程都稳，性价比优先选它'),
  p('gpt-6-luna', 'GPT-6 Luna', 'openai', 0.0501, 0.251, 0.005, '超低价高速版，适合批量摘要、简单问答、高频轻量请求'),
  p('gpt-5.6-sol', 'GPT-5.6 Sol', 'openai', 0.84, 5.04, 0.084, '上一代全能主力，复杂推理与代码仍很强，需要 Priority 加速时可选', {
    inputUsd: 1.01,
    outputUsd: 6.06,
    cachedInputUsd: 0.101
  }),
  p('gpt-5.6-terra', 'GPT-5.6 Terra', 'openai', 0.774, 4.64, 0.0774, '偏重分析与长文，适合文档审阅、方案撰写；高峰可开 Fast', {
    inputUsd: 4,
    outputUsd: 24,
    cachedInputUsd: 0.4
  }),
  p('gpt-5.6-luna', 'GPT-5.6 Luna', 'openai', 0.12, 0.721, 0.012, '便宜好用的日常模型，聊天、翻译、简单改写很合适', {
    inputUsd: 0.4,
    outputUsd: 2.4,
    cachedInputUsd: 0.04
  }),
  p('gpt-5.5', 'GPT-5.5', 'openai', 1.26, 7.59, 0.127, '较强综合能力，适合需要稳定质量的中高难度任务', {
    inputUsd: 0.8,
    outputUsd: 4.8,
    cachedInputUsd: 0.08
  }),
  p('gpt-5.4', 'GPT-5.4', 'openai', 1.25, 7.5, 0.125, '经典旗舰档，适合严谨写作与结构化输出'),
  p('gpt-5.4-mini', 'GPT-5.4 Mini', 'openai', 0.45, 2.7, 0.045, '轻量版，响应快，适合短回复与简单工具调用'),
  p('claude-opus-5-5', 'Claude Opus 5.5', 'anthropic', 1.01, 5.04, 0.0504, 'Claude 最新旗舰，长文写作、代码审查与复杂推理表现突出'),
  p('claude-fable-5-1', 'Claude Fable 5.1', 'anthropic', 2.5, 12.5, 0.0625, '创意与叙事向加强版，故事、文案、角色扮演更生动'),
  p('claude-opus-5', 'Claude Opus 5', 'anthropic', 1.28, 6.4, 0.128, '高品质深度推理，适合研究分析与重要文档修订'),
  p('claude-fable-5', 'Claude Fable 5', 'anthropic', 2.5, 12.5, 0.25, '偏创意表达，适合营销文案与长篇叙事'),
  p('claude-sonnet-5-5', 'Claude Sonnet 5.5', 'anthropic', 2, 10, 0.1, '速度和智能更均衡，适合日常编程、办公和通用对话'),
  p('claude-sonnet-5', 'Claude Sonnet 5', 'anthropic', 0.518, 2.59, 0.0518, 'Claude 日常主力，编程、办公、通用对话均衡可靠'),
  p('claude-opus-4-8', 'Claude Opus 4.8', 'anthropic', 1.39, 6.92, 0.139, '上代强推理，仍适合高难度分析与代码任务'),
  p('claude-opus-4-7', 'Claude Opus 4.7', 'anthropic', 1.38, 6.88, 0.138, '稳健的重型推理选项，兼容旧工作流'),
  p('claude-opus-4-6', 'Claude Opus 4.6', 'anthropic', 1.35, 6.78, 0.136, '成熟旗舰档，适合严谨写作与长上下文任务'),
  p('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'anthropic', 0.45, 2.25, 0.045, '性价比编程助手，日常开发与文档处理推荐'),
  p('claude-haiku-5-5', 'Claude Haiku 5.5', 'anthropic', 0.1, 0.5, 0.01, '高并发轻量模型，适合分类、抽取和路由；输入超过 10 万 tokens 按 5 倍长上下文价'),
  p('claude-haiku-4-5', 'Claude Haiku 4.5', 'anthropic', 0.15, 0.75, 0.015, '极速轻量，适合分类、抽取、短回复与高并发'),
  p('gemini-3.8-flash', 'Gemini 3.8 Flash', 'google', 0.29, 1.45, 0.029, 'Google 最新高速版，多模态与长上下文表现好'),
  p('gemini-3.7-flash', 'Gemini 3.7 Flash', 'google', 0.222, 1.11, 0.0222, '快且稳，适合搜索整理、多文件理解'),
  p('gemini-3.6-flash', 'Gemini 3.6 Flash', 'google', 0.18, 0.9, 0.018, '低成本 Flash，日常问答与摘要够用'),
  p('gemini-3.5-flash-lite', 'Gemini 3.5 Flash Lite', 'google', 0.087, 0.725, 0.0087, '最便宜的 Flash 档，大批量轻任务首选'),
  p('gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', 'google', 0.48, 2.88, 0.048, 'Pro 级深度推理预览，适合复杂分析与长文档'),
  p('gemini-3.5-flash', 'Gemini 3.5 Flash', 'google', 0.435, 2.61, 0.0435, '通用高速模型，办公与多模态场景均衡'),
  p('deepseek-flash', 'DeepSeek Flash', 'deepseek', 0.197, 0.786, 0.002, '国产高速推理，编程与数学性价比突出'),
  p('deepseek-flash-free', 'DeepSeek Flash Free', 'deepseek', 0.0003, 0.0012, 0, '几乎免费体验版，适合试玩与极低成本调用'),
  p('deepseek-v4-flash-vision-exp', 'DeepSeek V4 Flash Vision', 'deepseek', 0.44, 1.32, 0.007, '带视觉能力的实验版，适合看图问答与截图理解'),
  p('deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek', 0.8, 2.4, 0.0133, 'DeepSeek 高阶推理，复杂代码与数学更稳'),
  p('deepseek-v4-flash', 'DeepSeek V4 Flash', 'deepseek', 0.294, 0.883, 0.0047, 'V4 高速日常款，中文编程与问答推荐'),
  p('deepseek-v4-flash-free', 'DeepSeek V4 Flash Free', 'deepseek', 0.0004, 0.0013, 0, '免费档 Flash，测试与轻量脚本调用'),
  p('glm-5.3-flash', 'GLM 5.3 Flash', 'zhipu', 0.0825, 0.29, 0.0217, '智谱高速款，中文办公、客服话术性价比高'),
  p('glm-5.3-flash-free', 'GLM 5.3 Flash Free', 'zhipu', 0.0001, 0.0004, 0, '免费体验档，适合试用与极低成本请求'),
  p('glm-5.3', 'GLM 5.3', 'zhipu', 1.33, 4.17, 0.246, '智谱主力旗舰，中文写作、知识问答更扎实'),
  p('glm-5.2', 'GLM 5.2', 'zhipu', 0.84, 2.64, 0.156, '上代均衡款，中文对话与文档处理仍好用'),
  p('grok-4.7', 'Grok 4.7', 'xai', 2, 6, 0.5, 'xAI 当前最新款，短上下文价格与 Grok 4.6 相同，适合搜索感问答与复杂任务'),
  p('grok-4.6', 'Grok 4.6', 'xai', 0.202, 0.606, 0.0505, 'xAI 上一代旗舰，风格直白，适合搜索感问答与头脑风暴'),
  p('jev', 'Jev', 'other', 0.000042, 0, 0, '站内特殊路由模型，按实际能力选用')
]

/** 推荐偏好：仅当供应商实际提供该模型时才作为热门候选 */
const RECOMMEND_PREF = [
  'gpt-6.1-sol',
  'gpt-6.1-luna',
  'gpt-6.1-astra',
  'gpt-6-sol',
  'gpt-6-luna',
  'gpt-6-astra',
  'claude-opus-5-5',
  'claude-sonnet-5',
  'gpt-5.6-sol',
  'gpt-5.6-luna',
  'gpt-5.6-terra',
  'grok-4.7',
  'grok-4.6'
]

for (const id of RECOMMEND_PREF) {
  const model = MODEL_PRICES.find((item) => item.id === id)
  if (model) model.recommend = true
}

const META_BY_ID = Object.fromEntries(MODEL_PRICES.map((item) => [item.id, item])) as Record<string, ModelPrice>

export const PROVIDER_META: Record<ModelProvider, { label: string; color: string }> = {
  openai: { label: 'OpenAI', color: '#10a37f' },
  anthropic: { label: 'Claude', color: '#b45309' },
  google: { label: 'Google', color: '#1677ff' },
  deepseek: { label: 'DeepSeek', color: '#475569' },
  zhipu: { label: '智谱', color: '#6366f1' },
  xai: { label: 'xAI', color: '#c2410c' },
  other: { label: '其他', color: '#64748b' }
}

export function getModelMeta(modelId: string): ModelPrice | undefined {
  if (META_BY_ID[modelId]) return META_BY_ID[modelId]
  const hyphenated = modelId.replace(/(\d)\.(\d)/g, '$1-$2')
  return META_BY_ID[hyphenated]
}

export function resolveProvider(modelId: string, ownedBy?: string): ModelProvider {
  const known = getModelMeta(modelId)
  if (known) return known.provider
  const source = `${ownedBy || ''} ${modelId}`.toLowerCase()
  if (source.includes('anthropic') || source.includes('claude')) return 'anthropic'
  if (source.includes('openai') || source.includes('gpt')) return 'openai'
  if (source.includes('google') || source.includes('gemini')) return 'google'
  if (source.includes('deepseek')) return 'deepseek'
  if (source.includes('zhipu') || source.includes('glm')) return 'zhipu'
  if (source.includes('xai') || source.includes('grok')) return 'xai'
  return 'other'
}

function tierWeight(id: string): number {
  const lower = id.toLowerCase()
  if (lower.includes('astra')) return 60
  if (lower.includes('opus')) return 55
  if (lower.includes('sol')) return 50
  if (lower.includes('terra') || lower.includes('pro')) return 45
  if (lower.includes('fable') || lower.includes('sonnet')) return 40
  if (lower.includes('luna')) return 35
  if (lower.includes('haiku') || lower.includes('mini') || lower.includes('flash')) return 25
  if (lower.includes('free') || lower.includes('lite')) return 10
  return 30
}

function familyWeight(id: string): number {
  const lower = id.toLowerCase()
  if (lower.includes('gpt')) return 100
  if (lower.includes('claude')) return 90
  if (lower.includes('gemini')) return 80
  if (lower.includes('deepseek')) return 70
  if (lower.includes('glm')) return 60
  if (lower.includes('grok')) return 50
  return 20
}

/** 解析模型名中的版本数字，用于「新→旧」排序；目录外的模型也能正确排（如 gpt-6.1-sol） */
export function modelVersionParts(modelId: string): number[] {
  const parts = [...modelId.toLowerCase().matchAll(/(\d+)/g)].map((m) => Number(m[1]))
  while (parts.length < 4) parts.push(0)
  return parts.slice(0, 6)
}

/** 越大越新 */
export function modelRecencyScore(modelId: string): number[] {
  return [familyWeight(modelId), ...modelVersionParts(modelId), tierWeight(modelId)]
}

export function compareModelNewestFirst(aId: string, bId: string): number {
  const a = modelRecencyScore(aId)
  const b = modelRecencyScore(bId)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const diff = (b[i] || 0) - (a[i] || 0)
    if (diff) return diff
  }
  return aId.localeCompare(bId)
}

export function sortModelIdsNewestFirst(ids: string[]): string[] {
  return [...ids].sort(compareModelNewestFirst)
}

export type DisplayModelBase = {
  id: string
  name?: string
  owned_by?: string
}

/** 给供应商返回的模型补齐展示字段；不删除任何供应商模型 */
export function enrichVendorModel<T extends DisplayModelBase>(item: T) {
  const meta = getModelMeta(item.id)
  return {
    ...item,
    name: item.name || meta?.name || item.id,
    provider: resolveProvider(item.id, item.owned_by),
    intro: meta?.intro || '供应商当前可用模型，可按价格与任务复杂度选用',
    recommendPref: Boolean(meta?.recommend)
  }
}

/**
 * 从「当前供应商实际可用」模型中挑选热门展示。
 * 优先推荐偏好里且真实存在的，不足再用最新模型补齐。
 */
export function pickFeaturedModelIds(availableIds: string[], limit = 3): string[] {
  const available = new Set(availableIds)
  const picked: string[] = []
  for (const id of RECOMMEND_PREF) {
    if (available.has(id) && !picked.includes(id)) picked.push(id)
    if (picked.length >= limit) return picked
  }
  for (const id of sortModelIdsNewestFirst(availableIds)) {
    if (!picked.includes(id)) picked.push(id)
    if (picked.length >= limit) break
  }
  return picked
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
}

/** TeamRouter 图像模型简介（仅绑定文案，是否展示看供应商价目） */
export const IMAGE_MODEL_INTRO: Record<string, string> = {
  'gpt-image-2.5-sunburst': '最新图像旗舰，细节与美感更强，适合海报、产品图、高质量创作；Teamo 按输出最长边分 1K/2K/4K 按张计费',
  'gpt-image-2.5-flare': '与 Sunburst 同级的新版图像模型，风格略更鲜明；Teamo 按 1K/2K/4K 按张计费',
  'gpt-image-2': '当前主力图像模型，质量与成本均衡；Teamo 按输出最长边 1K/2K/4K 按张计费',
  'gemini-3.1-flash-image': 'Gemini 图像模型，按文本输入 / 输出 tokens 计费',
  'gpt-image-1.5': '上一代高质量图像，适合需要稳定写实/插画效果的任务',
  'chatgpt-image-latest': 'ChatGPT 最新图像通道，适合通用出图与快速试验',
  'gpt-image-1-mini': '轻量低成本图像模型，适合草稿、批量试错',
  'gpt-image-1': '经典 GPT Image，兼容旧工作流'
}

export function getImageModelIntro(modelId: string): string {
  const id = (modelId || '').toLowerCase()
  if (IMAGE_MODEL_INTRO[id]) return IMAGE_MODEL_INTRO[id]
  for (const key of Object.keys(IMAGE_MODEL_INTRO).sort((a, b) => b.length - a.length)) {
    if (id === key || id.startsWith(`${key}-`) || id.startsWith(`${key}.`)) {
      return IMAGE_MODEL_INTRO[key]
    }
  }
  return '供应商当前可用图像模型，价格完全跟随上游价目'
}

/** Teamo GPT Image：按输出最长边分档。<=1024→1k，<=2048→2k，其余→4k */
export function resolveImageSizeTier(size?: string): '1k' | '2k' | '4k' {
  const raw = (size || '').trim().toLowerCase()
  if (raw === '1k' || raw === '2k' || raw === '4k') return raw
  if (raw === 'auto' || !raw) return '1k'
  if (raw.includes('x')) {
    const [a, b] = raw.split('x', 2)
    const longest = Math.max(parseInt(a, 10) || 0, parseInt(b, 10) || 0)
    if (longest <= 0) return '1k'
    if (longest <= 1024) return '1k'
    if (longest <= 2048) return '2k'
    return '4k'
  }
  return '1k'
}

export function isPerImageBilling(model?: {
  billing?: string
  per_image_tiers?: Record<string, number> | null
}): boolean {
  if (!model) return false
  if (model.billing === 'per_image') return true
  const tiers = model.per_image_tiers
  return !!(tiers && Object.keys(tiers).length > 0)
}

export function pickImageTierPrice(
  tiers: Record<string, number> | undefined,
  size?: string
): number | null {
  if (!tiers) return null
  const key = resolveImageSizeTier(size)
  const direct = tiers[key] ?? tiers[key.toUpperCase()]
  if (typeof direct === 'number') return direct
  const fallback = tiers['1k'] ?? tiers['2k'] ?? tiers['4k']
  return typeof fallback === 'number' ? fallback : null
}

export interface EstimateUsage {
  inputTokens: number
  cachedHitTokens: number
  outputTokens: number
}

export function estimateCharge(model: ModelPrice, usage: EstimateUsage, tier: PriceTier = 'standard') {
  const prices = tier === 'fast' && model.fast ? model.fast : model
  const multiplier = tier === 'fast' && !model.fast ? 2 : 1
  const input = (prices.inputUsd * multiplier * usage.inputTokens) / 1_000_000
  const hit = (prices.cachedInputUsd * multiplier * usage.cachedHitTokens) / 1_000_000
  const output = (prices.outputUsd * multiplier * usage.outputTokens) / 1_000_000
  return { input, hit, output, total: input + hit + output }
}

/** @deprecated 请用 compareModelNewestFirst；保留兼容旧引用 */
export const MODEL_RECENCY: Record<string, number> = Object.fromEntries(
  MODEL_PRICES.map((item, index) => [item.id, index])
)
