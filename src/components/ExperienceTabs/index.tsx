import { Link, useLocation } from 'react-router-dom'
import { CommentOutlined, PictureOutlined } from '@ant-design/icons'
import styles from './index.module.less'

/**
 * 模型体验页签（S3）
 * ------------------------------------------------------------
 * 「对话」和「绘图」原本是两个一级菜单，占了两格还分散注意力。
 * 现在合成一个「模型体验」，页内用两个页签切换，菜单只占一格。
 */
function ExperienceTabs() {
  const { pathname } = useLocation()
  const isDraw = pathname === '/draw'

  return (
    <div className={styles.tabs} role="tablist" aria-label="模型体验">
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
