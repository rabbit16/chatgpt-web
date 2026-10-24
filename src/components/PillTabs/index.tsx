import { ReactNode } from 'react'
import styles from './index.module.less'

export type PillTabItem<T extends string = string> = {
  key: T
  label: ReactNode
  icon?: ReactNode
}

type Props<T extends string> = {
  items: PillTabItem<T>[]
  value: T
  onChange: (key: T) => void
  /** 无障碍标签，例如「公告与留言页签」 */
  ariaLabel?: string
  /**
   * 视觉变体：
   * - muted（默认）：浅灰槽，靠在浅色内容区里不抢戏（工作台、公告页用）
   * - solid：白底 + 1px 描边 + 品牌色选中态
   *   用在页面背景本身也是浅灰的场合（如充值商城），否则「槽」和背景同色，
   *   未选中项就是几个灰字浮在页面上，用户看不出这仨能点（站长 2026-10-24 反馈）。
   */
  variant?: 'muted' | 'solid'
}

/**
 * 页签（药丸式）
 * ------------------------------------------------------------
 * 全站统一：AI 工作台、充值商城、公告/留言都用这一套，避免每页自己写一份。
 */
function PillTabs<T extends string>({ items, value, onChange, ariaLabel, variant = 'muted' }: Props<T>) {
  return (
    <div
      className={[styles.tabs, variant === 'solid' ? styles.tabsSolid : ''].join(' ')}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          className={[styles.tab, value === item.key ? styles.active : ''].join(' ')}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default PillTabs
