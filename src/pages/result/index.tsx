import { useEffect, useRef, useState } from 'react'
import { Button, Card, Popconfirm, Result, Space } from 'antd'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import { payVerify, queryXuHuPayOrder } from '@/request/api'
import { userStore } from '@/store'
import { clearPendingOrder, isPayOk, normalizePayload, readPendingOrder, savePendingOrder } from '@/utils/payment'

const wallet = '/price?tab=wallet'

type Status = 'checking' | 'pending' | 'success' | 'failed' | 'unavailable'
const statusText = {
  checking: ['正在查询订单', '正在向支付渠道核对原订单。'],
  pending: ['支付待确认', '暂未收到渠道确认。若已完成支付，请先刷新原订单，避免重复充值。'],
  success: ['支付成功', '支付渠道已确认，请到钱包核对余额和支付记录。'],
  failed: ['支付失败', '支付渠道报告该订单失败，可以返回钱包查看记录。'],
  unavailable: ['暂无法确认支付结果', '请回钱包核对支付记录。如有原订单，可以刷新查单。']
} as const

export default function ResultPage() {
  const token = userStore((state) => state.token)
  const account = userStore((state) => state.user_info) as { data?: { bodyMessage?: { userId?: string | number } } } | undefined
  const accountId = String(account?.data?.bodyMessage?.userId || '')
  const [savedOrder] = useState(() => readPendingOrder())
  const order = savedOrder && (!savedOrder.userId || savedOrder.userId === accountId) ? savedOrder : null
  const oldOrder = Boolean(order && Date.now() - order.createdAt >= 30 * 60 * 1000)
  const [status, setStatus] = useState<Status>('checking')
  const requestInFlight = useRef(false)

  async function check() {
    if (requestInFlight.current) return
    if (!token || !order) {
      setStatus('unavailable')
      return
    }
    requestInFlight.current = true
    setStatus('checking')
    try {
      const response = order.channel === 'xunhupay'
        ? await queryXuHuPayOrder(order.outTradeNo)
        : await payVerify({ codeNum: order.outTradeNo })
      const payload = normalizePayload<{ paid?: boolean; status?: string }>(response)
      if (isPayOk(response) && (order.channel === 'lantu' || payload.paid === true)) {
        setStatus('success')
        clearPendingOrder(order.outTradeNo)
      } else if (['failed', 'closed', 'cancelled'].includes(String(payload.status).toLowerCase())) {
        setStatus('failed')
        clearPendingOrder(order.outTradeNo)
      } else {
        setStatus(isPayOk(response) || order.channel === 'lantu' ? 'pending' : 'unavailable')
      }
    } catch {
      setStatus('unavailable')
    } finally {
      requestInFlight.current = false
    }
  }

  useEffect(() => {
    if (token && order?.awaitingReturn) savePendingOrder({ ...order, awaitingReturn: false })
    void check()
  }, [token, order])

  return <Layout>
    <Card style={{ maxWidth: 720, margin: '24px auto', borderRadius: 16 }}>
      <Result status={status === 'success' ? 'success' : status === 'failed' ? 'error' : 'info'}
        title={statusText[status][0]}
        subTitle={<><p>{statusText[status][1]}</p>{token && order && <p className="num">订单 {order.outTradeNo} · ¥{order.money.toFixed(2)}</p>}</>}
        extra={<Space wrap>
          <Link to={wallet}><Button type="primary">回钱包查单</Button></Link>
          {token && order && oldOrder && ['pending', 'unavailable'].includes(status) && (
            <Popconfirm title="已在钱包核对原单且确定没有付款？" description="继续将清除本机查单提示。渠道订单及支付记录仍保留。" onConfirm={() => {
              clearPendingOrder(order.outTradeNo)
              setStatus('unavailable')
            }} okText="结束本机查单" cancelText="继续核对">
              <Button>结束本机查单</Button>
            </Popconfirm>
          )}
          {token && order && status !== 'success' && status !== 'failed' && <Button loading={status === 'checking'} onClick={() => void check()}>刷新订单状态</Button>}
        </Space>}
      />
    </Card>
  </Layout>
}
