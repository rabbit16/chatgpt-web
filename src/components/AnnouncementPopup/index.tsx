import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { getLatestAnnouncement, type AnnouncementItem } from '@/request/api'
import styles from './index.module.less'

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

  return (
    <Modal
      open={open && !!item}
      zIndex={2000}
      title={
        <span className={styles.title}>
          <NotificationOutlined /> {item?.title || '公告'}
        </span>
      }
      onCancel={() => setOpen(false)}
      footer={[
        <Button key="ok" type="primary" onClick={() => setOpen(false)}>
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
