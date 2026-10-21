import { useState } from 'react'
import { Button } from 'antd'
import { Link } from 'react-router-dom'
import { CloseOutlined } from '@ant-design/icons'
import styles from './index.module.less'

const DISMISS_KEY = 'anygpt_promo_bar_closed'

/**
 * 未登录访客的转化条（S2-b）
 * ------------------------------------------------------------
 * 定位：首页就是体验区，但访客很容易把它当成"又一个聊天工具"。
 * 这里用一行、不超过两行的横条，说明"这是卖 API 的站"，并给出唯一主动作（注册）。
 * 关闭后本次浏览器会话不再出现（sessionStorage），不打扰体验。
 */
function MarketingBar({ onRegister }: { onRegister: () => void }) {
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (closed) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // 隐私模式写不进去，忽略
    }
    setClosed(true)
  }

  return (
    <div className={styles.bar}>
      <span className={styles.tag}>API 中转</span>
      <span className={styles.text}>
        一个地址接通 GPT / Claude / Gemini，按量付费，余额与账单随时可查
      </span>
      <div className={styles.actions}>
        <Button type="primary" size="small" onClick={onRegister}>
          免费注册
        </Button>
        <Link to="/price" className={styles.link}>
          看价格 →
        </Link>
      </div>
      <button type="button" className={styles.close} aria-label="关闭提示" onClick={dismiss}>
        <CloseOutlined />
      </button>
    </div>
  )
}

export default MarketingBar
