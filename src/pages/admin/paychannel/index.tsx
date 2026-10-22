import { useEffect, useState } from 'react'
import { Alert, Button, Card, Radio, Space, Tag, message } from 'antd'
import { paymentStore } from '@/store'
import type { PayChannel } from '@/store/payment/slice'
import { getPayChannel, getXuHuPayStatus, setPayChannel } from '@/request/api'

const CHANNEL_DESC: Record<PayChannel, { desc: string; api: string }> = {
  xunhupay: {
    desc: '微信四通道，手机自动 H5 跳转，电脑展示二维码；充多少到账多少。',
    api: '/user/xunhupay/pay'
  },
  lantu: {
    desc: '沿用原有 /pay_rabbit 聚合支付，回调走 /verify_rabbit。',
    api: '/user/pay_rabbit'
  }
}

const DEFAULT_CHANNELS: Array<{ value: PayChannel; name: string }> = [
  { value: 'xunhupay', name: '虎皮椒' },
  { value: 'lantu', name: '蓝兔（旧通道）' }
]

function PayChannelPage() {
  const channel = paymentStore((state) => state.channel)
  const channels = paymentStore((state) => state.channels)
  const [draft, setDraft] = useState<PayChannel>(channel)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [missing, setMissing] = useState<string[]>([])

  const list = channels.length ? channels : DEFAULT_CHANNELS

  const loadChannel = () => {
    setLoading(true)
    getPayChannel()
      .then((res: any) => {
        const data = res?.data || res || {}
        if (String(data.code) !== '0' || !data.channel) return
        paymentStore.getState().setFromServer({
          channel: data.channel,
          channels: data.channels
        })
        setDraft(data.channel)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }

  const checkXuHuPay = () => {
    setChecking(true)
    getXuHuPayStatus()
      .then((res: any) => {
        const data = res.data || {}
        setConfigured(Boolean(data.configured))
        setMissing(Array.isArray(data.missing) ? data.missing : [])
      })
      .catch(() => setConfigured(null))
      .finally(() => setChecking(false))
  }

  useEffect(() => {
    loadChannel()
    checkXuHuPay()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res: any = await setPayChannel({ channel: draft })
      const data = res?.data || res || {}
      if (String(data.code) !== '0') {
        message.error(data.codeMsg || '切换失败')
        return
      }
      paymentStore.getState().setFromServer({
        channel: data.channel || draft,
        channels: data.channels
      })
      message.success('已切换，所有用户下次打开页面即生效')
    } catch {
      message.error('切换失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="这是全站设置"
        description="配置保存在后端，切换后所有用户都会走新通道。用户已打开的页面需刷新一次才会拿到新配置。"
      />
      <Card title="选择支付通道" loading={loading}>
        <Radio.Group
          value={draft}
          onChange={(e) => setDraft(e.target.value as PayChannel)}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {list.map((item) => {
              const meta = CHANNEL_DESC[item.value]
              return (
                <Radio key={item.value} value={item.value} style={{ width: '100%' }}>
                  <Space direction="vertical" size={2}>
                    <Space wrap>
                      <strong>{item.name}</strong>
                      {meta && <Tag>{meta.api}</Tag>}
                      {item.value === channel && <Tag color="blue">当前生效</Tag>}
                      {item.value === 'xunhupay' && configured === false && (
                        <Tag color="red">后端未配置</Tag>
                      )}
                      {item.value === 'xunhupay' && configured === true && (
                        <Tag color="green">后端已配置</Tag>
                      )}
                    </Space>
                    {meta && <span style={{ color: '#667085', fontSize: 13 }}>{meta.desc}</span>}
                  </Space>
                </Radio>
              )
            })}
          </Space>
        </Radio.Group>

        <Space style={{ marginTop: 20 }}>
          <Button type="primary" loading={saving} disabled={draft === channel} onClick={save}>
            保存并全站生效
          </Button>
          <Button onClick={loadChannel}>重新读取</Button>
        </Space>

        <div style={{ marginTop: 20 }}>
          <Space>
            <span style={{ color: '#667085' }}>
              虎皮椒配置自检：
              {checking ? '检查中…' : configured === null ? '未知' : configured ? '正常' : '不可用'}
            </span>
            <a onClick={checkXuHuPay}>重新检查</a>
          </Space>
          {configured === false && missing.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message={`后端缺少配置：${missing.join('、')}`}
              description="需在 gpt_backend 的 .env 补齐 XUNHUPAY_APPID / XUNHUPAY_APPSECRET 后重启服务。"
            />
          )}
        </div>
      </Card>
    </div>
  )
}

export default PayChannelPage
