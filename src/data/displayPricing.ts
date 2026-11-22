import { compareModelNewestFirst, enrichVendorModel } from '@/data/modelPricing'
import { findOfficialPricing } from '@/data/officialPricing'
import type { PricingMetric, UserModelRate, UserPricing } from '@/request/api'

const previewOrder = ['gpt-6.1-sol', 'claude-opus-5-5', 'deepseek-v4-pro', 'gemini-3.8-flash']

export const pricingMetrics: { key: PricingMetric; label: string }[] = [
  { key: 'input', label: '输入' },
  { key: 'cache_read', label: '缓存读取' },
  { key: 'cache_write', label: '缓存写入' },
  { key: 'output', label: '输出' }
]

export function isPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function isUsdPerMillionTokens(currency: string, unit: string) {
  return currency === 'USD' && typeof unit === 'string' && /^(?:usd )?per (?:1m|million) tokens$/i.test(unit.trim())
}

export function formatTokenPrice(value: number) {
  if (value > 0 && value < 0.000001) return `$${value.toExponential(2)}`
  return `$${Number(value.toFixed(6))}`
}

export function getStandardPrice(rate: UserModelRate, key: PricingMetric, pricing: UserPricing) {
  const explicit = rate.standard_prices?.[key]
  if (isPrice(explicit)) return explicit

  const { discount } = pricing
  const original = rate[`original_${key}`]
  if (
    rate.billing_basis === 'cost' && !isPrice(original) &&
    Number.isFinite(discount) && discount > 0 && isPrice(rate[key])
  ) {
    const standard = rate[key] / discount
    if (isPrice(standard)) return standard
  }
}

export function getOfficialComparison(
  rate: UserModelRate,
  key: PricingMetric,
  currency: string,
  longContext = false
) {
  const official = findOfficialPricing(rate)
  if (!official || !isUsdPerMillionTokens(currency, rate.unit) ||
    !isUsdPerMillionTokens(official.currency, official.unit) ||
    !Number.isFinite(Date.parse(official.checked_at))) return

  let source: URL
  try {
    source = new URL(official.source)
  } catch {
    return
  }
  if (source.protocol !== 'https:' || source.username || source.password) return

  const long = rate.long_context
  if (longContext && (!long || long.threshold !== official.long_context?.threshold ||
    long.op !== official.long_context.op)) return

  const current = longContext ? long?.[key] : rate[key]
  const baseline = longContext ? official.long_context?.[key] : official[key]
  if (!isPrice(current) || !isPrice(baseline)) return

  const ratio = (current / baseline) * 10
  const label = current === baseline || Math.abs(ratio - 10) < 1e-10
    ? '与官方价一致'
    : current > baseline
    ? '高于官方价'
    : ratio > 9.95
    ? '较官方价略低'
    : ratio > 0 && ratio < 0.1
    ? '较官方价不到 0.1 折'
    : `较官方价 ${Number(ratio.toFixed(1))} 折`

  return { baseline, label, discounted: current < baseline, source: source.href, checkedAt: official.checked_at }
}

export function pickHomePriceModels(rates: UserModelRate[], currency: string) {
  const candidates = new Map<string, UserModelRate>()
  for (const rate of rates) {
    if (rate.model && rate.service_tier === 'standard' && isPrice(rate.input) && isPrice(rate.output) &&
      isUsdPerMillionTokens(currency, rate.unit) && !candidates.has(rate.model)) {
      candidates.set(rate.model, rate)
    }
  }

  const preferred = (id: string) => {
    const index = previewOrder.indexOf(id)
    return index < 0 ? previewOrder.length : index
  }
  const releaseDate = (rate: UserModelRate) => Date.parse(rate.released_at || '') || 0
  const sorted = [...candidates.values()]
    .sort((a, b) => releaseDate(b) - releaseDate(a) || preferred(a.model) - preferred(b.model) ||
      compareModelNewestFirst(a.model, b.model))
    .map((rate) => ({ rate, model: enrichVendorModel({
      id: rate.model,
      name: rate.display_name,
      owned_by: rate.owned_by
    }) }))
  const providers = new Set<string>()
  const diverse = sorted.filter(({ model }) => {
    if (providers.has(model.provider)) return false
    providers.add(model.provider)
    return true
  })
  return [...diverse, ...sorted.filter((item) => !diverse.includes(item))].slice(0, 3)
}
