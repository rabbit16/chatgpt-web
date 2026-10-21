import { CSSProperties, ReactNode } from 'react'
import { useInView } from '@/hooks/useInView'
import styles from './index.module.less'

type Props = {
  children: ReactNode
  /** 延迟，毫秒；同一排卡片可以错开 60ms 形成节奏 */
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'article'
  style?: CSSProperties
}

/**
 * 入场包裹器：滚到位置才淡入上移，只播一次。
 * 动效是“解释顺序”的：先看到标题，再看到内容，而不是一屏同时闪。
 */
function Reveal({ children, delay = 0, className, as = 'div', style }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const Tag = as as any
  return (
    <Tag
      ref={ref}
      className={[styles.reveal, inView ? styles.visible : '', className].filter(Boolean).join(' ')}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  )
}

export default Reveal
