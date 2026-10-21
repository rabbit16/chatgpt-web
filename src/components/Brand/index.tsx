import React from 'react'
import { Link } from 'react-router-dom'
import { configStore } from '@/store'
import styles from './index.module.less'

type Props = {
  /** ProLayout 传下来的值，优先用 store，空则回退这里 */
  title?: string
  logo?: string
  /** 紧凑模式：只显示图标（窄屏用） */
  compact?: boolean
}

const DEFAULT_TITLE = 'anyGPT'
const DEFAULT_LOGO = '/logo.svg'

/**
 * 品牌区（T2）
 * ------------------------------------------------------------
 * 解决"顶部品牌区为空"：后台配置为空时回退本地 logo + anyGPT，
 * 保证任何情况下都有品牌可见，不再出现空白。
 */
function Brand({ title, logo, compact = false }: Props) {
  const storeLogo = configStore((state) => state.website_logo)
  const storeTitle = configStore((state) => state.website_title)

  const finalLogo = storeLogo || logo || DEFAULT_LOGO
  const finalTitle = storeTitle || title || DEFAULT_TITLE

  return (
    <Link to="/" className={styles.brand} aria-label={`${finalTitle} 首页`}>
      <img className={styles.brand__logo} src={finalLogo} alt="" />
      {!compact && <span className={styles.brand__title}>{finalTitle}</span>}
    </Link>
  )
}

export default Brand
