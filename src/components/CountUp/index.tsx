import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useInView } from '@/hooks/useInView'
import styles from './index.module.less'

type Props = {
  value: number
  duration?: number
  suffix?: string
  className?: string
}

/**
 * 数字滚动：进入视口后从 0 滚到目标值，只播一次。
 * 用等宽数字，滚动过程不会把排版挤来挤去。
 */
function CountUp({ value, duration = 1100, suffix = '', className }: Props) {
  const { ref, inView } = useInView<HTMLSpanElement>()
  // 初值直接给最终数字：如果用户没滚到这里（或截图时），也不会看到刺眼的 0
  const [display, setDisplay] = useState(value)
  const startedRef = useRef(false)
  const frameRef = useRef(0)

  useEffect(() => {
    if (!inView || startedRef.current) return
    startedRef.current = true
    if (prefersReducedMotion()) {
      setDisplay(value)
      return
    }
    setDisplay(0)
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      // easeOutCubic：先快后慢，像数字“落定”
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [inView, value, duration])

  return (
    <span ref={ref} className={[styles.count, className].filter(Boolean).join(' ')}>
      {display}
      {suffix}
    </span>
  )
}

export default CountUp
