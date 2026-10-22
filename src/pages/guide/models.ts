import { PUBLIC_MODELS } from '@/data/publicPricing'
import { resolveProvider, type ModelProvider } from '@/data/modelPricing'
import { RELAY_HOST, RELAY_URL } from '@/utils/relay'

/**
 * 接入指南 · 模型 → 协议 的对照表
 * ------------------------------------------------------------
 * 站长要求：模型和协议必须绑定，别让人自己猜。
 * 所以这里把「选哪个模型」当成唯一入口，选完之后
 * 接口地址、API 格式、认证变量、模型映射全部自动算出来。
 *
 * 规则来自供应商实际行为：
 *   claude-*  → Anthropic 原生协议，地址不带 /v1
 *   其余模型  → OpenAI 兼容协议，地址带 /v1
 */

export type GuideProtocol = 'anthropic' | 'openai'

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
  formatLabel: 'Anthropic Messages（原生）',
  authLabel: 'Bearer Token',
  baseUrl: RELAY_HOST,
  mappingLabel: 'Fable 留空 · Haiku / Sonnet / Opus 保持「与主模型相同」',
  why: 'claude- 开头的模型走 Anthropic 原生协议，地址不要带 /v1'
}

const OPENAI_META: GuideProtocolMeta = {
  key: 'openai',
  formatLabel: 'OpenAI 兼容',
  authLabel: 'Bearer Token',
  baseUrl: RELAY_URL,
  mappingLabel: '没有模型映射这一栏，留空即可',
  why: '这类模型走 OpenAI 兼容协议，地址要带 /v1'
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

export function providerLabel(provider: ModelProvider) {
  return PROVIDER_LABEL[provider]
}

/** 价格页同源的模型清单（去掉图片模型，只留能对话的） */
export const GUIDE_MODELS: GuideModel[] = PUBLIC_MODELS.map((item) => {
  const provider = resolveProvider(item.model, item.owned_by)
  return { id: item.model, provider, protocol: protocolOf(provider) }
})

/** 按供应商分组，给「选模型」下拉做分栏 */
export function groupModels(models: GuideModel[] = GUIDE_MODELS) {
  const groups = new Map<ModelProvider, GuideModel[]>()
  for (const model of models) {
    const list = groups.get(model.provider)
    if (list) list.push(model)
    else groups.set(model.provider, [model])
  }
  return [...groups.entries()].map(([provider, list]) => ({
    label: PROVIDER_LABEL[provider],
    options: list.map((model) => ({
      value: model.id,
      label: `${model.id} · ${protocolOf(provider) === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容'}`
    }))
  }))
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
