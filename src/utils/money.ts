/**
 * 金额与数字的统一格式化（2026-10-24 视觉验收 P3）
 * ------------------------------------------------------------
 * 之前全站有三套各自的实现：
 *   - pages/usage/index.tsx：一律 `toFixed(6)` → ¥542.187200
 *   - pages/price/index.tsx：按大小分档（≥1 两位、≥0.01 四位…）
 *   - pages/shop 顶部条与钱包各算各的
 * 结果同一个余额出现 ¥128.18 和 128.209 两个值，用户会以为算错账。
 *
 * 现在统一规则：
 *   1. 余额 / 累计 / 额度（金额 ≥ 1 元）→ ¥ 两位小数 + 千分位
 *   2. 单次扣费等小额（< 1 元）→ 四位小数，去掉末尾 0（¥0.0390 → ¥0.039）
 *   3. 极小且非零 → 六位小数去末尾 0，避免显示成 ¥0.00 让人以为没扣费
 *   4. 一律带货币符号，不允许裸数字出现在钱的位置
 */

/** 金额格式化：返回带 ¥ 的字符串 */
export function formatCny(value: number | string | null | undefined): string {
  const num = Number(value)
  if (value == null || Number.isNaN(num)) return '-'
  if (num === 0) return '¥0.00'

  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  // ≥ 1 元：两位小数 + 千分位
  if (abs >= 1) {
    return `${sign}¥${abs.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  // ≥ 0.01 元：四位小数，去末尾 0
  if (abs >= 0.01) {
    const text = abs.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    return `${sign}¥${text}`
  }
  // 更小但非零：六位小数，去末尾 0（避免显示成 ¥0.00）
  const tiny = abs.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return `${sign}¥${tiny}`
}

/** 美元单价：保留 6 位有效小数，去末尾 0 */
export function formatUsd(value: number | string | null | undefined): string {
  const num = Number(value)
  if (value == null || Number.isNaN(num)) return '-'
  if (num === 0) return '$0'
  const text = num.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return `$${text}`
}

/** 整数（tokens、次数）：千分位 */
export function formatCount(value: number | string | null | undefined): string {
  const num = Number(value)
  if (value == null || Number.isNaN(num)) return '-'
  return num.toLocaleString('zh-CN')
}
