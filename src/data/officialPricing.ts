/**
 * 官方原价对照表（用于价格页「比官方省多少」）
 * ------------------------------------------------------------
 * 数据来源优先级：
 *   1) 站点价目接口返回的 `original_input` / `original_output` 字段（有就用，最准）
 *   2) 本文件的人工录入（站长核对官网后填，适合接口不返回原价的模型）
 *
 * 为什么要单独一张表：价格是经营承诺，不能猜。没录入的模型页面上就显示「—」，
 * 绝不按"大概"算一个省钱比例出来。
 *
 * 录入格式（key 用小写 model id）：
 *   'gpt-5.4': { input: 2.5, output: 10, source: 'https://openai.com/api/pricing', checkedAt: '2026-10-21' }
 */

export type OfficialPrice = {
  /** 官方输入价，USD / 百万 tokens */
  input: number
  /** 官方输出价，USD / 百万 tokens */
  output?: number
  /** 官网价格页地址，供核对 */
  source?: string
  /** 核对日期 */
  checkedAt?: string
}

/** 官方价表（暂无录入时为空对象，页面不会显示对比列，也不会报错） */
export const OFFICIAL_PRICING: Record<string, OfficialPrice> = {}

/** 本表最后一次核对日期（显示在价格页说明里） */
export const OFFICIAL_PRICING_UPDATED_AT = ''

/** 规格后缀不影响价格比对，先归一化再查表 */
function normalizeId(model: string) {
  return model
    .toLowerCase()
    .replace(/\s*\((fast|slow|beta|preview|exp)\)\s*/g, '')
    .replace(/\s+/g, '')
    .trim()
}

export function lookupOfficialPrice(model: string): OfficialPrice | undefined {
  if (!model) return undefined
  const exact = OFFICIAL_PRICING[model.toLowerCase()]
  if (exact) return exact
  const key = normalizeId(model)
  const hit = Object.keys(OFFICIAL_PRICING).find((item) => normalizeId(item) === key)
  return hit ? OFFICIAL_PRICING[hit] : undefined
}

/**
 * 综合算出「官方价」：接口字段优先，其次查表
 * 返回 undefined 表示没有可靠官方价——调用方必须显示「—」，不要瞎算
 */
export function resolveOfficialPrice(
  model: string,
  apiOriginal?: { input?: number | null; output?: number | null } | null
): OfficialPrice | undefined {
  if (apiOriginal?.input && apiOriginal.input > 0) {
    return {
      input: apiOriginal.input,
      output: apiOriginal.output ?? undefined,
      source: '站点价目接口 original_input',
      checkedAt: ''
    }
  }
  return lookupOfficialPrice(model)
}

/** 省了多少：返回 0~1 的比例，没有官方价或官方价更低时返回 undefined */
export function savingRatio(ours: number, official?: number) {
  if (!official || official <= 0 || ours <= 0) return undefined
  if (ours >= official) return undefined
  return 1 - ours / official
}
