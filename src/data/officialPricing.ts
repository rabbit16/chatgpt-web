import type { OfficialModelPricing, UserModelRate } from '@/request/api'

const reviewedOn = '2026-11-22'
const currency = 'USD'
const unit = 'USD per 1M tokens'

const standardCatalog: Record<string, OfficialModelPricing> = {
  'openai/gpt-6.1-sol': {
    currency, unit, checked_at: reviewedOn,
    input: 2, output: 10, cache_read: 0.1,
    source: 'https://openai.com/index/introducing-gpt-6-1-sol/'
  },
  'anthropic/claude-opus-5-5': {
    currency, unit, checked_at: reviewedOn,
    input: 4, output: 20, cache_read: 0.2, cache_write: 5,
    source: 'https://www.anthropic.com/news/claude-opus-5-5'
  },
  'anthropic/claude-haiku-4-5': {
    currency, unit, checked_at: reviewedOn,
    input: 1, output: 5,
    source: 'https://www.anthropic.com/news/claude-haiku-4-5'
  }
}

export function findOfficialPricing(rate: UserModelRate) {
  if (rate.official_pricing !== undefined) return rate.official_pricing
  if (rate.service_tier !== 'standard') return
  return standardCatalog[`${rate.owned_by?.toLowerCase()}/${rate.model}`]
}
