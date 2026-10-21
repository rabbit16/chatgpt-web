import { useCallback, useEffect, useState } from 'react'
import { Empty, Pagination, Spin, Tag } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { getAnnouncementList, type AnnouncementItem } from '@/request/api'
import styles from './index.module.less'

const PAGE_SIZE = 10

export function AnnouncementPanel() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<AnnouncementItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadList = useCallback(async (nextPage = 1) => {
    setLoading(true)
    try {
      const res: any = await getAnnouncementList({ page: nextPage, page_num: PAGE_SIZE })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList(1)
  }, [loadList])

  return (
    <div className={styles.panel}>
          <section className={styles.card}>
            <div className={styles.listHead}>
              <h2>全部公告</h2>
              <span>共 {total} 条，最新在前</span>
            </div>
            <Spin spinning={loading}>
              {list.length === 0 ? (
                <Empty description="暂无公告" />
              ) : (
                <div className={styles.list}>
                  {list.map((item, index) => (
                    <article key={item.id} className={styles.item}>
                      <div className={styles.itemMeta}>
                        {index === 0 && page === 1 ? <Tag color="blue">最新</Tag> : null}
                        <strong>{item.title}</strong>
                        <time>{item.insert_time}</time>
                      </div>
                      <div className={styles.content}>{item.content}</div>
                    </article>
                  ))}
                </div>
              )}
            </Spin>
            {total > PAGE_SIZE ? (
              <div className={styles.pager}>
                <Pagination
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={total}
                  showSizeChanger={false}
                  onChange={(next) => loadList(next)}
                />
              </div>
            ) : null}
          </section>
    </div>
  )
}

export default AnnouncementPanel
