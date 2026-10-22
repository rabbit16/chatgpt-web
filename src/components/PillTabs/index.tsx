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
}

/**
 * 页签（药丸式）
 * ------------------------------------------------------------
 * 全站统一：AI 工作台、充值商城、公告/留言都用这一套，避免每页自己写一份。
 */
function PillTabs<T extends string>({ items, value, onChange, ariaLabel }: Props<T>) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
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
