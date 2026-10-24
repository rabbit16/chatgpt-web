import { useMemo } from 'react'
import styles from './index.module.less'

type Point = { day: string; tokens: number }

type Props = {
  /** 首选：页面已经按天汇总好的点（来自 /usage/summary，覆盖完整 14 天） */
  points?: { day: string; tokens: number }[] | null
  /** 降级：原始记录，用 created_at + token 自己聚合成按天的点 */
  items?: { created_at: string | null; input_tokens: number | null; output_tokens: number | null }[]
  /** 展示天数 */
  days?: number
  /** 降级取数被截断（例如最近 200 条装不下 14 天）时提示"近似" */
  degraded?: boolean
}

/**
 * 用量趋势小图
 * ------------------------------------------------------------
 * 不引第三方图表库，直接用 SVG 画折线 + 面积，体积为 0。
 * 目的：让人一眼看到"这几天用了多少"，而不是对着一堆表格数字自己算。
 *
 * 两种数据源：
 * 1) points：页面按天查汇总接口得到，14 天齐全（首选）；
 * 2) items ：老后端没有汇总接口时退回原始记录，可能只覆盖几小时。
 *
 * 空态与稀疏态必须分开处理——否则「14 天里只用了 1 天」会画成一条贴底的斜线，
 * 看起来像图坏了（站长 2026-10-24 反馈）。
 */
function Sparkline({ points: presetPoints, items = [], days = 14, degraded = false }: Props) {
  // 本地时区拼 key：toISOString() 在东八区会把 00:00–08:00 的数据算到前一天
  const localKey = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  const points = useMemo<Point[]>(() => {
    const buckets = new Map<string, number>()
    const now = new Date()
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      buckets.set(localKey(d), 0)
    }

    if (presetPoints) {
      presetPoints.forEach((p) => {
        if (!p?.day) return
        if (buckets.has(p.day)) buckets.set(p.day, p.tokens)
      })
    } else {
      items.forEach((item) => {
        if (!item.created_at) return
        // created_at 是服务器本地时间、不带时区，直接截前 10 位即可
        const key = item.created_at.slice(0, 10)
        if (!buckets.has(key)) return
        buckets.set(key, (buckets.get(key) || 0) + (item.input_tokens || 0) + (item.output_tokens || 0))
      })
    }

    return [...buckets.entries()].map(([day, tokens]) => ({ day, tokens }))
  }, [items, presetPoints, days])

  const max = Math.max(0, ...points.map((p) => p.tokens))
  const total = points.reduce((sum, p) => sum + p.tokens, 0)
  const activeDays = points.filter((p) => p.tokens > 0).length
  const peakDay = points.reduce<Point | null>((best, p) => (!best || p.tokens > best.tokens ? p : best), null)

  // 状态判定：全空 / 只有 1 天有数据 / 正常
  const isEmpty = total === 0
  const tooSparse = !isEmpty && activeDays < 2

  const W = 100
  const H = 34
  const step = points.length > 1 ? W / (points.length - 1) : W
  const coords = points.map((p, i) => {
    const x = i * step
    const y = H - (p.tokens / Math.max(1, max)) * (H - 6) - 3
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
        <span className={styles.trendPeak}>
          {isEmpty ? `近 ${days} 天没有计费消耗` : `峰值 ${max.toLocaleString('zh-CN')} / 天`}
        </span>
      </div>

      {isEmpty ? (
        /* 全空：不画一条贴底的线让人误会，直接一句话说明 */
        <div className={styles.trendEmpty}>这 {days} 天还没有产生计费消耗，发一条消息后这里会出现曲线。</div>
      ) : tooSparse ? (
        /* 只有 1 天有值：折线没有意义，改成一行摘要 */
        <div className={styles.trendSparse}>
          <span>
            仅 <b>{activeDays}</b> 天有记录
          </span>
          <span>
            峰值出现在 <b>{peakDay?.day.slice(5)}</b>
          </span>
          <span>
            其余 {days - activeDays} 天为 0
          </span>
        </div>
      ) : (
        <>
          <svg className={styles.trendChart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <path d={area} className={styles.trendArea} />
            <path d={line} className={styles.trendLine} />
          </svg>
          <div className={styles.trendAxis}>
            <span>{points[0]?.day.slice(5)}</span>
            <span>{points[Math.floor(points.length / 2)]?.day.slice(5)}</span>
            <span>{points[points.length - 1]?.day.slice(5)}</span>
          </div>
        </>
      )}

      {degraded ? (
        <p className={styles.trendDegraded}>汇总接口不可用，上图仅覆盖最近 200 条请求，14 天数据可能不全。</p>
      ) : null}
    </section>
  )
}

export default Sparkline
