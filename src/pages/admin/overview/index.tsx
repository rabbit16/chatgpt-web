import { useEffect, useState } from 'react'
import { Alert, Button, Card, Skeleton, Table } from 'antd'
import { getAdminOverview } from '@/request/api'
import styles from '../index.module.less'

function AdminOverview() {
  const [data, setData] = useState<any>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function loadOverview() {
    setLoading(true)
    setError(false)
    try {
      const res = await getAdminOverview()
      if (String(res?.code) !== '0' || String(res?.data?.code ?? '0') !== '0') throw new Error('读取失败')
      setData(res.data || {})
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadOverview() }, [])

  const overview = data.overview || {}
  const billing = data.billing || {}
  const models = (data.models || []).filter((item: any) => item.type === 'chat')

  return (
    <div>
      <h1>后台总览</h1>
      {loading ? <Skeleton active /> : error ? <Alert type="error" showIcon message="暂时无法读取总览" action={<Button onClick={() => void loadOverview()}>重试</Button>} /> : <>
      <div className={styles.cards}>
        <div className={styles.card}>
          <label>用户总数</label>
          <b>{overview.user_count || 0}</b>
        </div>
        <div className={styles.card}>
          <label>正常 / 封禁</label>
          <b>
            {overview.active_user_count || 0} / {overview.banned_user_count || 0}
          </b>
        </div>
        <div className={styles.card}>
          <label>余额合计</label>
          <b>¥{Number(overview.balance_sum || 0).toFixed(2)}</b>
        </div>
        <div className={styles.card}>
          <label>今日消耗</label>
          <b>¥{Number(overview.today_consume || 0).toFixed(4)}</b>
        </div>
        <div className={styles.card}>
          <label>未读留言</label>
          <b>{overview.unread_feedback || 0}</b>
        </div>
        <div className={styles.card}>
          <label>充值订单</label>
          <b>{overview.order_count || 0}</b>
        </div>
        <div className={styles.card}>
          <label>充值总额</label>
          <b>¥{Number(overview.order_sum || 0).toFixed(2)}</b>
        </div>
        <div className={styles.card}>
          <label>盈利倍率</label>
          <b>{billing.profitRate || '-'}</b>
        </div>
      </div>
      <Card title="当前对话模型与用户价">
        <Table
          rowKey="mode"
          pagination={false}
          dataSource={models}
          /* 手机上必须允许横滚：原来没配 scroll.x，中文被压成竖排单字，
             行高从 56px 撑到 135px（2026-10-24 视觉验收第 3 条）。 */
          scroll={{ x: 720 }}
          columns={[
            { title: '模型', dataIndex: 'label', width: 200 },
            { title: 'ID', dataIndex: 'mode', width: 200 },
            { title: '输入 ¥ / 百万', dataIndex: 'input_cny_per_1m', width: 150, align: 'right' as const },
            { title: '输出 ¥ / 百万', dataIndex: 'output_cny_per_1m', width: 150, align: 'right' as const }
          ]}
        />
        <p style={{ marginTop: 12, color: '#667085' }}>
          汇率 {billing.usdToCny} ，倍率 {billing.profitRate}。改价请改后端 `settings/billing.py`。
        </p>
      </Card>
      </>}
    </div>
  )
}

export default AdminOverview
