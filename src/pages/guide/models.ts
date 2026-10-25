import { PUBLIC_MODEL_IDS, PUBLIC_MODELS } from '@/data/publicPricing'
import { compareModelNewestFirst, resolveProvider, type ModelProvider } from '@/data/modelPricing'
import { RELAY_HOST, RELAY_URL } from '@/utils/relay'

/**
 * 接入指南 · 模型 → 协议 的对照表
 * ------------------------------------------------------------
 * 站长要求：模型和协议必须绑定，别让人自己猜。
 * 所以这里把「选哪个模型」当成唯一入口，选完之后
 * 接口地址、API 格式、认证变量、模型映射全部自动算出来。
 *
 * 规则来自供应商实际行为（2026-10-25 站长更新）：
 *   claude-*  → Anthropic 原生协议，地址不带 /v1
 *   其余模型  → OpenAI Responses API (代理转换)，地址带 /v1
 *
 * 为什么不是「OpenAI 兼容」：CC-Haha 的「API 格式」下拉里没有这四个字，
 * 用户拿着「OpenAI 兼容」在软件里找不到对应项。formatLabel 必须和下拉逐字一致，
 * 所以字面值统一收在 FORMAT_LABELS 一处，页面只引用、不重写。
 */

export type GuideProtocol = 'anthropic' | 'openai'

/**
 * CC-Haha「API 格式」下拉可选项的三种（2026-10-25）
 * ------------------------------------------------------------
 * anthropic = a) Anthropic Messages (原生)  → Claude 系，地址不带 /v1
 * responses = c) OpenAI Responses API (代理转换) → 其余全部，地址带 /v1（推荐）
 * chat      = b) OpenAI Chat Completions (代理转换) → 老客户端才用，一般不用选
 */
export type GuideFormatKey = 'anthropic' | 'responses' | 'chat'

/**
 * 下拉里的原文
 * ------------------------------------------------------------
 * 这里是**唯一**字面值来源：页面文案、/guide 的 HahaMock、默认项条、
 * 地址旁的格式药丸全部引用它。改之前先对着 CC-Haha 截图逐字核对，
 * 软件里多一个空格、括号全角半角不同，用户就对照不上。
 */
export const FORMAT_LABELS: Record<GuideFormatKey, string> = {
  // 括号必须是**半角**：CC-Haha 下拉里原文就是 `Anthropic Messages (原生)`。
  // 全角「（原生）」符合中文排版习惯，但用户去软件里逐字对照会对不上，别改回去。
  anthropic: 'Anthropic Messages (原生)',
  responses: 'OpenAI Responses API (代理转换)',
  chat: 'OpenAI Chat Completions (代理转换)'
}

/** 一条「API 格式」选项，/agent 页拿去渲染三分支对照表 */
export interface GuideFormatOption {
  key: GuideFormatKey
  /** 软件下拉里没有字母，这里只为对照教程时好指认 */
  letter: 'a' | 'b' | 'c'
  /** 下拉原文（>FORMAT_LABELS） */
  label: string
  /** 什么情况下选它 */
  scope: string
  /** 配哪条地址 */
  baseUrl: string
  baseUrlNote: string
  /** pick = 该选；avoid = 一般不用选（不是不能用，别写成完全不可用） */
  tone: 'pick' | 'avoid'
  /** 行尾标记文案 */
  badge: string
}

/**
 * 三分支对照表（顺序按推荐优先级排，不按字母）
 * ------------------------------------------------------------
 * 先两个「该选的」（a / c），最后才是「一般不用选」的 b。
 * 每项保留真实字母，用户在下拉里照样能对上。
 */
export const FORMAT_OPTIONS: GuideFormatOption[] = [
  {
    key: 'anthropic',
    letter: 'a',
    label: FORMAT_LABELS.anthropic,
    scope: '模型名是 claude- 开头的（Claude 全系）',
    baseUrl: RELAY_HOST,
    baseUrlNote: '不带 /v1',
    tone: 'pick',
    badge: '✅ 推荐 · Claude 系'
  },
  {
    key: 'responses',
    letter: 'c',
    label: FORMAT_LABELS.responses,
    scope: '除 Claude 以外全部：GPT、Gemini、DeepSeek、Grok……',
    baseUrl: RELAY_URL,
    baseUrlNote: '带 /v1',
    tone: 'pick',
    badge: '✅ 推荐 · 其余全部'
  },
  {
    key: 'chat',
    letter: 'b',
    label: FORMAT_LABELS.chat,
    scope: '只有老版本客户端、或个别只认这个格式的软件才需要',
    baseUrl: RELAY_URL,
    baseUrlNote: '带 /v1',
    tone: 'avoid',
    badge: '一般不用选'
  }
]

/** 协议 → 下拉原文：给「地址旁标格式」用，别在页面里再写一遍字面值 */
export function formatLabelOf(protocol: GuideProtocol) {
  return protocol === 'anthropic' ? FORMAT_LABELS.anthropic : FORMAT_LABELS.responses
}

export interface GuideProtocolMeta {
  key: GuideProtocol
  /** Claude-haha「API 格式」下拉里要选的那一项 */
  formatLabel: string
  /** 认证变量 */
  authLabel: string
  /** 接口地址 */
  baseUrl: string
  /** 模型映射怎么填（Anthropic 才有这一栏） */
  mappingLabel: string
  /** 一句话解释为什么是这个协议 */
  why: string
}

const ANTHROPIC_META: GuideProtocolMeta = {
  key: 'anthropic',
  formatLabel: FORMAT_LABELS.anthropic,
  authLabel: 'Bearer Token',
  baseUrl: RELAY_HOST,
  mappingLabel: 'Fable 留空 · Haiku / Sonnet / Opus 保持「与主模型相同」',
  why: 'claude- 开头的模型走 Anthropic 原生协议，地址不要带 /v1'
}

const OPENAI_META: GuideProtocolMeta = {
  key: 'openai',
  formatLabel: FORMAT_LABELS.responses,
  authLabel: 'Bearer Token',
  baseUrl: RELAY_URL,
  mappingLabel: '没有模型映射这一栏，留空即可',
  /* 一句话说清「为什么是 c 不是 b」：b 也能通，但属于旧格式，
     新模型的新参数要经过它再转一层，容易丢细节、报错也更难查。 */
  why: '这些模型现在统一走 Responses：地址带 /v1，选它最稳；Chat Completions 是老格式，能通但容易丢新模型的参数'
}

export function protocolOf(provider: ModelProvider): GuideProtocol {
  return provider === 'anthropic' ? 'anthropic' : 'openai'
}

export function protocolMeta(provider: ModelProvider): GuideProtocolMeta {
  return protocolOf(provider) === 'anthropic' ? ANTHROPIC_META : OPENAI_META
}

export interface GuideModel {
  id: string
  /** 供应商展示名，如 OpenAI / Claude */
  provider: ModelProvider
  protocol: GuideProtocol
}

const PROVIDER_LABEL: Record<ModelProvider, string> = {
  anthropic: 'Claude',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  zhipu: '智谱',
  xai: 'xAI',
  other: '其他'
}

/** 下拉里分组的先后顺序：主力厂商在前，认不出的归「其他」放最后 */
const PROVIDER_ORDER: ModelProvider[] = ['openai', 'anthropic', 'google', 'deepseek', 'xai', 'zhipu', 'other']

export function providerLabel(provider: ModelProvider) {
  return PROVIDER_LABEL[provider]
}

/**
 * 本站全部可对话模型（价格页同源快照，去掉图片模型）
 * ------------------------------------------------------------
 * 这里必须**按模型去重**：价目快照是按 `model + service_tier` 一行一行的，
 * 同一个 claude-opus-5-5 会同时有 standard 和 fast 两行。
 * 以前直接把 81 行全铺进下拉，于是同一个模型出现 2~3 次、列表里几乎全是 Claude。
 * 现在：先按 model 去重，再按「供应商分组 + 新→旧」排。
 */
export const GUIDE_MODELS: GuideModel[] = (() => {
  // model_ids 是供应商给的顺序，也用来兜底补齐（快照里没有的 id 也能出现）
  const byId = new Map<string, string | undefined>()
  for (const item of PUBLIC_MODELS) {
    if (!item?.model) continue
    if (!byId.has(item.model)) byId.set(item.model, item.owned_by)
  }
  for (const id of PUBLIC_MODEL_IDS) {
    if (!byId.has(id)) byId.set(id, undefined)
  }

  return [...byId.entries()]
    .map(([id, ownedBy]) => {
      const provider = resolveProvider(id, ownedBy)
      return { id, provider, protocol: protocolOf(provider) }
    })
    .sort((a, b) => compareModelNewestFirst(a.id, b.id))
})()

/** 按供应商分组，给「选模型」下拉做分栏；每组标题带数量，一眼看出本站有哪些模型 */
export function groupModels(models: GuideModel[] = GUIDE_MODELS) {
  const groups = new Map<ModelProvider, GuideModel[]>()
  for (const model of models) {
    const list = groups.get(model.provider)
    if (list) list.push(model)
    else groups.set(model.provider, [model])
  }
  return PROVIDER_ORDER.filter((provider) => groups.has(provider)).map((provider) => {
    const list = groups.get(provider)!
    return {
      label: `${PROVIDER_LABEL[provider]} · ${list.length} 个`,
      options: list.map((model) => ({
        value: model.id,
        /* 与下拉逐字一致的口径：Claude 走 Anthropic，其余走 Responses。
           这里不放全称（下拉项本身很长，塞进 200px 的选项会挤），
           全称在正文「API 格式 · xxx」那一行给。 */
        label: `${model.id} · ${protocolOf(provider) === 'anthropic' ? 'Anthropic' : 'Responses'}`
      }))
    }
  })
}

/** 本站模型总数与厂商数，页面上用一句话说清「这里真的是全站模型」 */
export function guideModelSummary(models: GuideModel[] = GUIDE_MODELS) {
  const providers = new Set(models.map((model) => model.provider))
  return { total: models.length, providers: providers.size }
}

/** 推荐默认：优先 Claude 主力款，没有就退到第一个可用模型 */
export function defaultGuideModel(models: GuideModel[] = GUIDE_MODELS): GuideModel | undefined {
  return (
    models.find((model) => model.id === 'claude-sonnet-5') ||
    models.find((model) => /^claude-sonnet/i.test(model.id)) ||
    models.find((model) => model.protocol === 'anthropic') ||
    models[0]
  )
}

export function findModel(id: string, models: GuideModel[] = GUIDE_MODELS) {
  return models.find((model) => model.id === id) || defaultGuideModel(models)
}
