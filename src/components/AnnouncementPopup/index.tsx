import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { getLatestAnnouncement, type AnnouncementItem } from '@/request/api'
import styles from './index.module.less'

/**
 * 公告弹窗
 * ------------------------------------------------------------
 * 原来每进一次页面就弹一次，很打扰。
 * 现在记住"已经读过哪一条"（存在浏览器本地），同一条只弹一次；
 * 站长发布新公告时 id 变化，会再弹一次。
 */
const SEEN_KEY = 'anygpt_announcement_seen'

function readSeenId() {
  try {
    return window.localStorage.getItem(SEEN_KEY) || ''
  } catch {
    return ''
  }
}

function markSeen(id: string | number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(id))
  } catch {
    // 隐私模式下写不进去，忽略即可，最多多弹一次
  }
}

function readLatest(res: any): AnnouncementItem | null {
  const payload = res?.data && typeof res.data === 'object' ? res.data : res
  const item = payload?.item || payload?.data?.item
  if (!item?.id) return null
  return item as AnnouncementItem
}

function AnnouncementPopup() {
  const [open, setOpen] = useState(false)
  const [item, setItem] = useState<AnnouncementItem | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getLatestAnnouncement()
        const latest = readLatest(res)
        if (cancelled || !latest) return
        // 同一条公告只弹一次，读过就不再打扰
        if (readSeenId() === String(latest.id)) return
        setItem(latest)
        setOpen(true)
      } catch {
        // 公告失败不影响主流程
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    if (item?.id) markSeen(item.id)
    setOpen(false)
  }

  return (
    <Modal
      open={open && !!item}
      zIndex={2000}
      title={
        <span className={styles.title}>
          <NotificationOutlined /> {item?.title || '公告'}
        </span>
      }
      onCancel={dismiss}
      footer={[
        <Button key="ok" type="primary" onClick={dismiss}>
          我知道了
        </Button>
      ]}
      destroyOnClose
      width={560}
    >
      {item ? (
        <div className={styles.body}>
          <div className={styles.meta}>{item.insert_time}</div>
          <div className={styles.content}>{item.content}</div>
        </div>
      ) : null}
    </Modal>
  )
}

export default AnnouncementPopup
