import { MODEL_PRICES } from '@/data/modelPricing'

export type LlmProtocol = 'openai' | 'anthropic'

export type ModelProtocolRule = { model?: string; protocol?: string }

const protocolByModel = new Map<string, LlmProtocol>()
let protocolRules: ModelProtocolRule[] = []

export function wildcardPrefix(pattern: string) {
  const text = pattern.trim().toLowerCase()
  if (text.length >= 3 && text.endsWith('*') && !text.slice(0, -1).includes('*')) return text.slice(0, -1)
  return ''
}

/** 与代理端一致：精确 > 更长前缀 > 整段 token。返回值越大越优先。 */
export function patternSpecificity(pattern: string, model: string): [number, number, number] | null {
  const rule = pattern.trim().toLowerCase()
  const name = model.trim().toLowerCase()
  if (!rule || !name) return null
  const star = wildcardPrefix(rule)
  if (star) return name.startsWith(star) ? [2, star.length, 0] : null
  if (rule === name) return [3, rule.length, 1]
  if (name.startsWith(rule) && (name.length === rule.length || name[rule.length] === '-')) return [2, rule.length, 1]
  if (!rule.includes('-') && name.split('-').includes(rule)) return [1, rule.length, 1]
  return null
}

function asChatProtocol(value?: string): LlmProtocol | null {
  const protocol = (value || '').trim().toLowerCase()
  if (protocol === 'anthropic') return 'anthropic'
  if (protocol === 'openai' || protocol === 'responses') return 'openai'
  return null
}

/** 记住 /v1/models 下发的协议，以及后台的模型协议规则。别名协议写在具体模型上，优先于规则。 */
export function rememberModelProtocols(
  items: Array<{ id?: string; protocol?: string }>,
  rules: ModelProtocolRule[] = []
) {
  protocolByModel.clear()
  for (const item of items) {
    const id = (item.id || '').trim().toLowerCase()
    const protocol = asChatProtocol(item.protocol)
    if (id && protocol) protocolByModel.set(id, protocol)
  }
  protocolRules = rules.filter((rule) => rule.model && asChatProtocol(rule.protocol))
}

function protocolFromRules(model: string): LlmProtocol | null {
  let best: [number, number, number] | null = null
  let chosen: LlmProtocol | null = null
  for (const rule of protocolRules) {
    const score = patternSpecificity(rule.model || '', model)
    const protocol = asChatProtocol(rule.protocol)
    if (!score || !protocol) continue
    if (
      !best ||
      score[0] > best[0] ||
      (score[0] === best[0] && score[1] > best[1]) ||
      (score[0] === best[0] && score[1] === best[1] && score[2] > best[2])
    ) {
      best = score
      chosen = protocol
    }
  }
  return chosen
}

/** 按模型名解析上游协议：先看后台别名，再按 Claude 走 Anthropic，其余走 OpenAI 兼容。 */
export function resolveLlmProtocol(model: string): LlmProtocol {
  const raw = (model || '').trim()
  if (!raw) return 'openai'

  const id = raw.toLowerCase().replace(/^anthropic\//, '').replace(/^models\//, '')
  const configured = protocolByModel.get(id) || protocolByModel.get(raw.toLowerCase())
  if (configured) return configured
  const ruled = protocolFromRules(id) || protocolFromRules(raw.toLowerCase())
  if (ruled) return ruled

  const known = MODEL_PRICES.find(
    (item) => id === item.id || id.startsWith(`${item.id}-`) || id.startsWith(`${item.id}.`)
  )
  if (known?.provider === 'anthropic') return 'anthropic'
  if (/(^|\/)claude[\w./-]*/i.test(raw) || /anthropic/i.test(raw)) return 'anthropic'
  return 'openai'
}

export function llmChatPath(protocol: LlmProtocol): string {
  return protocol === 'anthropic' ? '/messages' : '/chat/completions'
}

/**
 * OpenAI 兼容接口的长度上限字段。
 * gpt-5 / gpt-6 与 o 系列拒绝 max_tokens，必须用 max_completion_tokens；其余仍用 max_tokens。
 */
export function openaiTokenLimitField(model: string): 'max_tokens' | 'max_completion_tokens' {
  const id = (model || '').trim().toLowerCase().replace(/^(openai|models)\//, '')
  if (/(^|\/)(o[134](-|$)|gpt-[5-9](\.|-|$))/.test(id)) return 'max_completion_tokens'
  return 'max_tokens'
}

/** 把已选的长度字段换成另一种。Anthropic 固定 max_tokens，不参与互换。 */
export function swapTokenLimitField(body: Record<string, unknown>): Record<string, unknown> | null {
  if (typeof body.max_tokens === 'number' && body.max_completion_tokens == null) {
    const { max_tokens, ...rest } = body
    return { ...rest, max_completion_tokens: max_tokens }
  }
  if (typeof body.max_completion_tokens === 'number' && body.max_tokens == null) {
    const { max_completion_tokens, ...rest } = body
    return { ...rest, max_tokens: max_completion_tokens }
  }
  return null
}

/** 上游明确说当前长度字段不被支持、并点名另一种时，才值得换字段重试。 */
export function errorWantsOtherTokenLimit(text: string): boolean {
  const lower = (text || '').toLowerCase()
  const mentionsLimit = lower.includes('max_tokens') || lower.includes('max_completion_tokens')
  const rejected = lower.includes('not supported') || lower.includes('unsupported')
  return mentionsLimit && rejected
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** 组装各协议请求体；Anthropic 要求 max_tokens，且 system 独立字段。 */
export function buildLlmRequestBody(params: {
  model: string
  messages: ChatMessage[]
  stream: true
  max_tokens?: number
}): { protocol: LlmProtocol; path: string; body: Record<string, unknown> } {
  const protocol = resolveLlmProtocol(params.model)
  const path = llmChatPath(protocol)

  if (protocol === 'anthropic') {
    const system = params.messages
      .filter((message) => message.role === 'system' && message.content)
      .map((message) => message.content)
      .join('\n\n')
    // Anthropic 要求 messages 以 user 开头，且 user/assistant 交替
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (const message of params.messages) {
      if (message.role !== 'user' && message.role !== 'assistant') continue
      if (!message.content) continue
      const last = messages[messages.length - 1]
      if (last && last.role === message.role) {
        last.content = `${last.content}\n\n${message.content}`
      } else {
        messages.push({ role: message.role, content: message.content })
      }
    }
    while (messages.length && messages[0].role !== 'user') messages.shift()

    return {
      protocol,
      path,
      body: {
        model: params.model,
        max_tokens: Math.max(1, Math.floor(params.max_tokens || 4096)),
        stream: true,
        messages,
        ...(system ? { system } : {})
      }
    }
  }

  const limitField = openaiTokenLimitField(params.model)
  return {
    protocol,
    path,
    body: {
      model: params.model,
      messages: params.messages,
      stream: true,
      ...(params.max_tokens != null ? { [limitField]: params.max_tokens } : {})
    }
  }
}

/** 从 SSE JSON 取出文本增量；计费片段返回 billing，不计入正文。 */
export function extractStreamDelta(
  item: any,
  protocol: LlmProtocol
): { text?: string; billingText?: string; done?: boolean; error?: string } {
  if (!item || typeof item !== 'object') return {}

  if (protocol === 'anthropic') {
    if (item.type === 'error' || item.error) {
      return { error: item.error?.message || item.message || 'LLM 返回错误' }
    }
    if (item.type === 'message_stop') return { done: true }
    if (item.type === 'content_block_delta' && item.delta?.type === 'text_delta') {
      const text = typeof item.delta.text === 'string' ? item.delta.text : ''
      if (!text) return {}
      if (text.includes('【计费】')) return { billingText: text }
      return { text }
    }
    return {}
  }

  if (item.error) return { error: item.error.message || 'LLM 返回错误' }
  if (item.id === 'billing') {
    const billingText = item.choices?.[0]?.delta?.content
    return typeof billingText === 'string' ? { billingText } : {}
  }
  const content = item.choices?.[0]?.delta?.content
  if (typeof content === 'string' && content) {
    if (content.includes('【计费】')) return { billingText: content }
    return { text: content }
  }
  return {}
}

export function parseBillingNoticeText(text: string): {
  input_tokens: number
  output_tokens: number
  cost: number
  balance: number
} | null {
  if (!text?.includes('【计费】')) return null
  const num = (re: RegExp) => {
    const match = text.match(re)
    return match ? Number(match[1]) : NaN
  }
  const input_tokens = num(/输入\s*([\d.]+)\s*tokens/)
  const output_tokens = num(/输出\s*([\d.]+)\s*tokens/)
  const cost = num(/实际花费\s*([\d.]+)\s*元/)
  const balance = num(/账户余额\s*([\d.]+)\s*元/)
  if ([input_tokens, output_tokens, cost, balance].some((value) => Number.isNaN(value))) return null
  return { input_tokens, output_tokens, cost, balance }
}
