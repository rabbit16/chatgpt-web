import { useEffect, useRef } from 'react'
import styles from './index.module.less'

type Props = {
  /** hero：首页大背景；soft：页头/区块的淡星图 */
  variant?: 'hero' | 'soft'
  /** 视差强度：0 不动，1 常规（首页 hero 用 0.35 比较稳） */
  parallax?: number
}

/**
 * 科技感底纹：一张手绘感的「星轨 + 节点」SVG 线稿。
 * 为什么不用粒子：粒子会盖住正文、拖慢滚动；线稿星轨既有未来感，又不会喧宾夺主。
 * 节点三颗分别对 OpenAI / Claude / Gemini，位置固定在轨道交叉处，暗示“一个入口接多家”。
 */
function TechBackdrop({ variant = 'soft', parallax = 0 }: Props) {
  const artRef = useRef<SVGSVGElement | null>(null)

  // 轻视差：背景比正文慢半拍上移，制造纵深；rAF 节流，滚动不掉帧
  useEffect(() => {
    if (!parallax) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        const y = window.scrollY || 0
        if (artRef.current) {
          artRef.current.style.transform = `translate3d(0, ${Math.min(y, 900) * parallax * 0.06}px, 0)`
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [parallax])

  return (
    <div
      className={[styles.backdrop, variant === 'hero' ? styles.hero : styles.soft].join(' ')}
      aria-hidden
      data-parallax={parallax}
    >
      <svg ref={artRef} className={styles.art} viewBox="0 0 1440 720" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="tb-glow" cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.16" />
            <stop offset="65%" stopColor="var(--brand)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tb-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.05" />
            <stop offset="50%" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="tb-line-2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6f5cff" stopOpacity="0.04" />
            <stop offset="50%" stopColor="#6f5cff" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6f5cff" stopOpacity="0.04" />
          </linearGradient>
        </defs>

        <rect width="1440" height="720" fill="url(#tb-glow)" />

        {/* 三层椭圆轨道，粗细递减 */}
        <g className={styles.orbitSlow} fill="none" stroke="url(#tb-line)">
          <ellipse cx="1040" cy="360" rx="430" ry="150" strokeWidth="1" transform="rotate(-16 1040 360)" />
          <ellipse cx="1040" cy="360" rx="330" ry="112" strokeWidth="1" transform="rotate(10 1040 360)" />
          <ellipse cx="1040" cy="360" rx="230" ry="74" strokeWidth="1.2" transform="rotate(-4 1040 360)" />
        </g>

        <g className={styles.orbitFast} fill="none" stroke="url(#tb-line-2)">
          <ellipse cx="1040" cy="360" rx="160" ry="160" strokeWidth="1" strokeDasharray="3 14" />
          <circle cx="1040" cy="360" r="86" strokeWidth="1" strokeDasharray="2 10" />
        </g>

        {/* 光点：轨道交点上的“模型” */}
        <g>
          <circle cx="716" cy="286" r="4" fill="var(--brand)" opacity="0.85" />
          <circle cx="716" cy="286" r="10" fill="var(--brand)" opacity="0.12" />
          <circle cx="1298" cy="430" r="3.5" fill="#6f5cff" opacity="0.8" />
          <circle cx="1298" cy="430" r="9" fill="#6f5cff" opacity="0.1" />
          <circle cx="1008" cy="556" r="3" fill="var(--brand)" opacity="0.7" />
          <circle cx="1008" cy="556" r="8" fill="var(--brand)" opacity="0.1" />
        </g>

        {/* 点阵网格，只在右上角淡出，避免整页花 */}
        <g className={styles.dots} opacity="0.5">
          {Array.from({ length: 30 }).map((_, row) =>
            Array.from({ length: 14 }).map((__, col) => (
              <circle key={`${row}-${col}`} cx={880 + col * 34} cy={60 + row * 34} r="1" fill="var(--text-5)" opacity="0.35" />
            ))
          )}
        </g>
      </svg>
      <div className={styles.fade} />
    </div>
  )
}

export default TechBackdrop
