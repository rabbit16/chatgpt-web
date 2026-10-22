import { Link, useLocation } from 'react-router-dom'
import { CommentOutlined, PictureOutlined } from '@ant-design/icons'
import styles from './index.module.less'

/**
 * AI 工作台页签
 * ------------------------------------------------------------
 * 「对话」和「绘图」原本是两个一级菜单，占了两格还分散注意力。
 * 现在合成一个「AI 工作台」，页内用两个页签切换，菜单只占一格。
 */
function ExperienceTabs() {
  const { pathname } = useLocation()
  const isDraw = pathname === '/draw'

  return (
    <div className={styles.tabs} role="tablist" aria-label="AI 工作台">
      <Link
        to="/chat"
        role="tab"
        aria-selected={!isDraw}
        className={[styles.tab, !isDraw ? styles.active : ''].join(' ')}
      >
        <CommentOutlined />
        对话
      </Link>
      <Link
        to="/draw"
        role="tab"
        aria-selected={isDraw}
        className={[styles.tab, isDraw ? styles.active : ''].join(' ')}
      >
        <PictureOutlined />
        绘图
      </Link>
    </div>
  )
}

export default ExperienceTabs
