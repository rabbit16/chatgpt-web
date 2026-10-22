import { useEffect, useState } from 'react'
import { Input, Table } from 'antd'
import { getAdminOrders } from '@/request/api'
import styles from '../index.module.less'

function AdminOrders() {
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<number | undefined>()
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const loadList = async (nextPage = 1, nextUserId = userId) => {
    setLoading(true)
    try {
      const res: any = await getAdminOrders({
        page: nextPage,
        page_num: 10,
        userId: nextUserId
      })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList(1)
  }, [])

  return (
    <div>
      <div className={styles.toolbar}>
        <Input.Search
          allowClear
          placeholder="按用户 ID 筛选"
          onSearch={(value) => {
            const nextUserId = value ? Number(value) : undefined
            setUserId(Number.isFinite(nextUserId) ? nextUserId : undefined)
            loadList(1, Number.isFinite(nextUserId) ? nextUserId : undefined)
          }}
          style={{ maxWidth: 280 }}
        />
      </div>
      <Table
        rowKey="bill_id"
        loading={loading}
        dataSource={list}
        pagination={{
          current: page,
          total,
          pageSize: 10,
          onChange: (next) => loadList(next)
        }}
        columns={[
          { title: '订单ID', dataIndex: 'bill_id' },
          { title: '用户ID', dataIndex: 'user_id' },
          {
            title: '金额',
            dataIndex: 'money',
            render: (value) => `¥${Number(value || 0).toFixed(2)}`
          },
          { title: '类型', dataIndex: 'function_name' },
          { title: '时间', dataIndex: 'generate_time' }
        ]}
      />
    </div>
  )
}

export default AdminOrders
