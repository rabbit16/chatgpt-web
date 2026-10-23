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
 * 换算规则（关键，别改错）：
 *   接口返回的是「当前账号折扣后的价」，快照里要存**标准价**，
 *   所以每个价格字段都除以本次返回的 discount，
 *   保证「访客看到的价 >= 登录后实际价」，不会出现标低了却收更多。
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

function scaleLongContext(long, discount) {
  if (!long || typeof long !== 'object') return long
  const out = { ...long }
  for (const field of ['input', 'output', 'cache_read', 'cache_write']) {
    if (typeof out[field] === 'number') out[field] = round(out[field] / discount)
  }
  return out
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

const discount = typeof data.discount === 'number' && data.discount > 0 ? data.discount : 1

// ---- 对话模型：价格字段除以折扣还原标准价 ----
const modelFields = ['input', 'output', 'cache_read', 'cache_write', 'original_input', 'original_output']
const models = data.models.map((row) => {
  const scaled = dividePrices(row, discount, modelFields)
  if (row.long_context) scaled.long_context = scaleLongContext(row.long_context, discount)
  return scaled
})

// ---- 图片模型：同样还原标准价，含按张分档 ----
const imageFields = ['text_input', 'image_input', 'output']
const imageModels = (data.image_models || []).map((row) => {
  const scaled = dividePrices(row, discount, imageFields)
  if (row.per_image_tiers) scaled.per_image_tiers = scaleImageTiers(row.per_image_tiers, discount)
  return scaled
})

// ---- model_ids：保持供应商顺序，缺则从 models 推 ----
const seen = new Set()
const modelIds = (data.model_ids && data.model_ids.length ? data.model_ids : models.map((m) => m.model)).filter(
  (id) => {
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  }
)

const today = new Date().toISOString().slice(0, 10)
const pretty = (value) => JSON.stringify(value, null, 2).replace(/\n/g, '\n')

const header = `/**
 * 公开参考价快照（自动生成，勿手改）
 * ------------------------------------------------------------
 * 生成时间：${today}
 * 数据来源：站点价目接口 \`GET /v1/pricing/models\`（匿名访问 401，故用密钥离线抓取后入库）
 * 换算规则：接口返回的是"当前账号折扣后价"，这里把价格字段除以折扣还原成**标准价**，
 *          所以访客看到的价 >= 登录后实际价，不会出现"标低了却收更多"。
 * 本次抓取折扣：discount = ${discount}
 * 用途：未登录访客在价格页也能看到模型与单价，解决"看不到价格就走"的转化漏洞。
 * 刷新：**不要手改**，跑 \`node scripts/sync-public-pricing.mjs\`（工作区文档：
 *      docs/公开价目快照-刷新方法.md）。改完 npm run build，未登录打开 /price 核对一遍。
 * 供应商：${data.vendor?.name || '-'}（${data.vendor?.code || '-'}）· 同步于 ${data.vendor?.last_synced_at || '-'}
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
