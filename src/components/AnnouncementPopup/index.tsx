import { useEffect, useState } from 'react'
import { Button, Modal } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { announcementStore, useAnnouncementUnread } from '@/store/announcement'
import styles from './index.module.less'

/**
 * 公告弹窗
 * ------------------------------------------------------------
 * 原来每进一次页面就弹一次，很打扰。
 * 现在统一由 `store/announcement` 管「最新一条」和「本机已读 id」：
 * 同一条只弹一次；关掉弹窗 = 标记已读，导航上的小红点同时消失。
 */
function AnnouncementPopup() {
  const latest = announcementStore((state) => state.latest)
  const load = announcementStore((state) => state.load)
  const markSeen = announcementStore((state) => state.markSeen)
  const unread = useAnnouncementUnread()
  // 打开后即使点了「已读」，弹窗也保持到用户手动关掉，避免闪
  const [open, setOpen] = useState(true)

  useEffect(() => {
    void load()
  }, [load])

  const dismiss = () => {
    markSeen()
    setOpen(false)
  }

  return (
    <Modal
      open={Boolean(unread && latest && open)}
      zIndex={2000}
      title={
        <span className={styles.title}>
          <NotificationOutlined /> {latest?.title || '公告'}
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
      {latest ? (
        <div className={styles.body}>
          <div className={styles.meta}>{latest.insert_time}</div>
          <div className={styles.content}>{latest.content}</div>
        </div>
      ) : null}
    </Modal>
  )
}

export default AnnouncementPopup
