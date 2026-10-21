import { useMemo } from 'react'
import styles from './index.module.less'

type Point = { day: string; tokens: number }

type Props = {
  /** 原始记录：用 created_at 与 token 字段自己聚合成按天的点 */
  items: { created_at: string | null; input_tokens: number | null; output_tokens: number | null }[]
  /** 展示天数 */
  days?: number
}

/**
 * 用量趋势小图
 * ------------------------------------------------------------
 * 不引第三方图表库，直接用 SVG 画折线 + 面积，体积为 0。
 * 目的：让人一眼看到"这几天用了多少"，而不是对着一堆表格数字自己算。
 */
function Sparkline({ items, days = 14 }: Props) {
  const points = useMemo<Point[]>(() => {
    const buckets = new Map<string, number>()
    const now = new Date()
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      buckets.set(d.toISOString().slice(0, 10), 0)
    }
    items.forEach((item) => {
      if (!item.created_at) return
      const key = item.created_at.slice(0, 10)
      if (!buckets.has(key)) return
      buckets.set(key, (buckets.get(key) || 0) + (item.input_tokens || 0) + (item.output_tokens || 0))
    })
    return [...buckets.entries()].map(([day, tokens]) => ({ day, tokens }))
  }, [items, days])

  const max = Math.max(1, ...points.map((p) => p.tokens))
  const total = points.reduce((sum, p) => sum + p.tokens, 0)

  const W = 100
  const H = 34
  const step = points.length > 1 ? W / (points.length - 1) : W
  const coords = points.map((p, i) => {
    const x = i * step
    const y = H - (p.tokens / max) * (H - 6) - 3
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const line = `M${coords.join(' L')}`
  const area = `${line} L${W},${H} L0,${H} Z`

  return (
    <section className={styles.trend}>
      <div className={styles.trendHead}>
        <div>
          <span className={styles.trendLabel}>近 {days} 天 Token 消耗</span>
          <b className={styles.trendValue}>{total.toLocaleString('zh-CN')}</b>
        </div>
        <span className={styles.trendPeak}>峰值 {max.toLocaleString('zh-CN')} / 天</span>
      </div>
      <svg className={styles.trendChart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={area} className={styles.trendArea} />
        <path d={line} className={styles.trendLine} />
      </svg>
      <div className={styles.trendAxis}>
        <span>{points[0]?.day.slice(5)}</span>
        <span>{points[Math.floor(points.length / 2)]?.day.slice(5)}</span>
        <span>{points[points.length - 1]?.day.slice(5)}</span>
      </div>
    </section>
  )
}

export default Sparkline
