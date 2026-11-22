/**
 * 刷新「公开参考价快照」 src/data/publicPricing.ts
 * ------------------------------------------------------------
 * 为什么要有这个脚本：
 *   价格页 / 首页 / 接入指南在**未登录**时也要能显示模型清单，
 *   但站点价目接口 `GET /v1/pricing/models` 匿名访问是 401（missing API key）。
 *   所以前端内置一份「离线快照」，访客看得到；登录用户仍然走实时接口。
 *
 * 快照会过期：站长新增/改价后，未登录访客看到的还是旧的那一份。
 *   以前是手工抓一次改写文件，容易忘、也容易漏模型 —— 现在一条命令搞定。
 *
 * 用法：
 *   RELAY_API_KEY=sk-xxx node scripts/sync-public-pricing.mjs
 *   或者把 key 写进环境变量文件后：
 *   node scripts/sync-public-pricing.mjs            # 读 $RELAY_API_KEY
 *
 * 使用站长批准的账号，只导出访客可见的价目。站内公开标准价优先读 standard_prices，
 * 普通成本计费项才按账号折扣还原。厂商官方价单独保留原值和来源。
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const target = resolve(root, 'src/data/publicPricing.ts')

const base = (process.env.RELAY_BASE_URL || 'https://www.rabbitj.top').replace(/\/$/, '')
const key = process.env.RELAY_API_KEY

if (!key) {
  console.error(
    [
      '缺少密钥。用法：',
      '  RELAY_API_KEY=sk-xxx node scripts/sync-public-pricing.mjs',
      '',
      '（key 在站点「密钥」页生成；不要把它写进仓库）'
    ].join('\n')
  )
  process.exit(1)
}

const round = (n) => (typeof n === 'number' ? Number(n.toFixed(10)) : n)

function dividePrices(row, discount, fields) {
  const out = { ...row }
  for (const field of fields) {
    if (typeof out[field] === 'number') out[field] = round(out[field] / discount)
  }
  return out
}

const metrics = ['input', 'output', 'cache_read', 'cache_write']
const isPrice = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const pick = (row, fields) => Object.fromEntries(fields.filter((field) => row[field] !== undefined).map((field) => [field, row[field]]))

function officialSnapshot(official) {
  if (!official || typeof official.source !== 'string' || !Number.isFinite(Date.parse(official.checked_at))) return
  try {
    const source = new URL(official.source)
    if (source.protocol !== 'https:' || source.username || source.password) return
  } catch {
    return
  }
  return {
    ...pick(official, [...metrics, 'currency', 'unit', 'source', 'checked_at']),
    ...(official.long_context ? { long_context: pick(official.long_context, [...metrics, 'threshold', 'op']) } : {})
  }
}

function scaleImageTiers(tiers, discount) {
  if (!tiers || typeof tiers !== 'object') return tiers
  const out = {}
  for (const [tier, price] of Object.entries(tiers)) {
    out[tier] = typeof price === 'number' ? round(price / discount) : price
  }
  return out
}

const response = await fetch(`${base}/v1/pricing/models`, {
  headers: { Authorization: `Bearer ${key}` }
})
if (!response.ok) {
  console.error(`拉取价目失败：HTTP ${response.status} ${await response.text()}`)
  process.exit(1)
}

const data = await response.json()
if (!Array.isArray(data.models) || !data.models.length) {
  console.error('价目返回为空，未写入，避免把线上页面刷成空白')
  process.exit(1)
}

const discount = Number.isFinite(data.discount) && data.discount > 0 ? data.discount : null

const models = data.models.flatMap((row) => {
  const price = (field) => {
    const explicit = row.standard_prices?.[field]
    if (isPrice(explicit)) return explicit
    if (row.billing_basis === 'cost' && !isPrice(row[`original_${field}`]) && discount && isPrice(row[field])) {
      return round(row[field] / discount)
    }
  }
  const prices = Object.fromEntries(metrics.map((field) => [field, price(field)]))
  if (!metrics.every((field) => isPrice(prices[field]))) return []

  const snapshot = { ...pick(row, ['model', 'display_name', 'owned_by', 'service_tier', 'unit', 'released_at']), ...prices }
  const official = officialSnapshot(row.official_pricing)
  if (row.official_pricing === null) snapshot.official_pricing = null
  else if (official) snapshot.official_pricing = official
  if (row.long_context && row.billing_basis === 'cost' && !metrics.some((field) => isPrice(row[`original_${field}`])) && discount) {
    snapshot.long_context = dividePrices(pick(row.long_context, [...metrics, 'threshold', 'op', 'input_multiplier', 'output_multiplier']), discount, metrics)
  }
  return [snapshot]
})

if (!models.length || !discount || data.currency !== 'USD') {
  console.error('缺少可验证的美元标准价或有效折扣，保留原有公开快照。')
  process.exit(1)
}

const imageFields = ['text_input', 'image_input', 'output']
const imageModels = (data.image_models || []).map((row) => {
  const scaled = dividePrices(pick(row, ['model', 'display_name', 'owned_by', 'service_tier', 'billing', 'unit', ...imageFields]), discount, imageFields)
  if (row.per_image_tiers) scaled.per_image_tiers = scaleImageTiers(pick(row.per_image_tiers, ['1k', '2k', '4k']), discount)
  return scaled
})

// ---- model_ids：保持供应商顺序，缺则从 models 推 ----
const publishedIds = new Set(models.map((row) => row.model))
const modelIds = [...new Set([...(data.model_ids || []), ...publishedIds])].filter((id) => publishedIds.has(id))

const today = new Date().toISOString().slice(0, 10)
const pretty = (value) => JSON.stringify(value, null, 2).replace(/\n/g, '\n')

const header = `/**
 * 公开参考价快照（自动生成，勿手改）
 * ------------------------------------------------------------
 * 生成时间：${today}
 * 数据来源：站点价目接口 \`GET /v1/pricing/models\`（匿名访问 401，故用密钥离线抓取后入库）
 * 站内报价存公开标准价。官方价单独保留来源及核实日期，金额原样导出。
 * 本次抓取折扣：discount = ${discount}
 * 用途：未登录访客在价格页也能看到模型与单价，解决"看不到价格就走"的转化漏洞。
 * 刷新：**不要手改**，跑 \`node scripts/sync-public-pricing.mjs\`（工作区文档：
 *      docs/公开价目快照-刷新方法.md）。改完 npm run build，未登录打开 /price 核对一遍。
 */
import type { UserModelRate, UserImageModelRate } from '@/request/api'

export const PUBLIC_PRICING_UPDATED_AT = '${today}'
export const PUBLIC_PRICING_NOTE = '参考价（站内标准倍率），登录后显示你的实际单价与折扣'

export const PUBLIC_MODEL_IDS: string[] = ${JSON.stringify(modelIds, null, 0)}

export const PUBLIC_MODELS: UserModelRate[] = ${JSON.stringify(models, null, 2)}

export const PUBLIC_IMAGE_MODELS: UserImageModelRate[] = ${JSON.stringify(imageModels, null, 2)}
`

writeFileSync(target, header, 'utf8')

const uniqueModels = new Set(models.map((m) => m.model)).size
console.log('已刷新 src/data/publicPricing.ts')
console.log(`  对话模型：${models.length} 行 / ${uniqueModels} 个（含 standard + fast 两档）`)
console.log(`  图片模型：${imageModels.length} 个`)
console.log(`  model_ids：${modelIds.length} 个`)
console.log(`  还原用折扣：${discount}`)
if (existsSync(target)) {
  const bytes = readFileSync(target).byteLength
  console.log(`  文件大小：${(bytes / 1024).toFixed(1)} KB`)
}
