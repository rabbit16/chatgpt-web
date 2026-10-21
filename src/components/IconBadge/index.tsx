import { ReactNode } from 'react'
import styles from './index.module.less'

export type IconBadgeTone = 'brand' | 'mint' | 'amber' | 'violet' | 'rose' | 'sky'

type Props = {
  icon: ReactNode
  /** 语义色：同一页面里最多用 3 种，避免变花 */
  tone?: IconBadgeTone
  /** 尺寸：sm=28（行内）、md=36（功能行）、lg=44（区块头） */
  size?: 'sm' | 'md' | 'lg'
  /** 圆角方块 or 圆形 */
  shape?: 'rounded' | 'circle'
  className?: string
}

/**
 * 图标徽章（统一图标呈现）
 * ------------------------------------------------------------
 * 之前每个页面的图标各自为政：有的裸图标、有的圆底、有的是彩色。
 * 这里统一成"柔和底色 + 同色系图标 + 圆角方块"，成为全站唯一的图标容器。
 */
function IconBadge({ icon, tone = 'brand', size = 'md', shape = 'rounded', className }: Props) {
  return (
    <span
      className={[styles.badge, styles[tone], styles[size], shape === 'circle' ? styles.circle : '', className || '']
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      {icon}
    </span>
  )
}

export default IconBadge
