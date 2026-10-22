import { useEffect, useState } from 'react'
import { Alert, Button, Spin, Tag, message } from 'antd'
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  MoneyCollectFilled,
  ReloadOutlined,
  SafetyCertificateOutlined,
  WalletOutlined
} from '@ant-design/icons'
import IconBadge from '@/components/IconBadge'
import { paymentStore } from '@/store'
import type { PayChannel } from '@/store/payment/slice'
import { getPayChannel, getXuHuPayStatus, setPayChannel } from '@/request/api'
import { isPayOk, normalizePayload, payErrorMessage } from '@/utils/payment'
import styles from './index.module.less'

/**
 * 后台 · 支付方式
 * ------------------------------------------------------------
 * 全站只有一个开关：所有用户充值时走哪个通道。
 * 配置存在后端，这里只是读取 / 切换；虎皮椒还提供一个「后端密钥是否配好」的自检。
 */

const CHANNEL_META: Record<PayChannel, { desc: string; api: string }> = {
  xunhupay: {
    desc: '微信支付：手机自动跳 H5、电脑展示二维码，充值金额实时到账。',
    api: 'POST /user/xunhupay/pay'
  },
  lantu: {
    desc: '蓝兔聚合支付（旧通道）：保留作回滚用，回调地址不变。',
    api: 'POST /user/pay_rabbit'
  }
}

const DEFAULT_CHANNELS: Array<{ value: PayChannel; name: string }> = [
  { value: 'xunhupay', name: '虎皮椒' },
  { value: 'lantu', name: '蓝兔（旧通道）' }
]

function AdminPayChannel() {
  const storeChannel = paymentStore((state) => state.channel)
  const [channel, setChannel] = useState<PayChannel>(storeChannel)
  const [draft, setDraft] = useState<PayChannel>(storeChannel)
  const [channels, setChannels] = useState<Array<{ value: PayChannel; name: string }>>(DEFAULT_CHANNELS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [missing, setMissing] = useState<string[]>([])
  const [gateway, setGateway] = useState('')

  const list = channels.length ? channels : DEFAULT_CHANNELS

  const loadChannel = async () => {
    setLoading(true)
    setError('')
    try {
      const res: any = await getPayChannel()
      const data = normalizePayload<any>(res)
      if (!isPayOk(res) || !data.channel) {
        setError(payErrorMessage(res, '读取支付通道失败，请稍后重试'))
        return
      }
      const nextChannel = data.channel as PayChannel
      const nextChannels = Array.isArray(data.channels) && data.channels.length ? data.channels : DEFAULT_CHANNELS
      setChannel(nextChannel)
      setDraft(nextChannel)
      setChannels(nextChannels)
      paymentStore.getState().setFromServer({ channel: nextChannel, channels: nextChannels })
    } catch {
      setError('读取支付通道失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const checkXuHuPay = async () => {
    setChecking(true)
    try {
      const res: any = await getXuHuPayStatus()
      const data = normalizePayload<any>(res)
      if (!isPayOk(res)) {
        setConfigured(null)
        return
      }
      setConfigured(Boolean(data.configured))
      setMissing(Array.isArray(data.missing) ? data.missing : [])
      setGateway(typeof data.gateway === 'string' ? data.gateway : '')
    } catch {
      setConfigured(null)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    void loadChannel()
    void checkXuHuPay()
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res: any = await setPayChannel({ channel: draft })
      const data = normalizePayload<any>(res)
      if (!isPayOk(res)) {
        message.error(payErrorMessage(res, '切换失败，请稍后重试'))
        return
      }
      const nextChannel = (data.channel || draft) as PayChannel
      const nextChannels =
        Array.isArray(data.channels) && data.channels.length ? data.channels : channels
      setChannel(nextChannel)
      setDraft(nextChannel)
      setChannels(nextChannels)
      paymentStore.getState().setFromServer({ channel: nextChannel, channels: nextChannels })
      message.success('已切换，所有用户下次打开页面即生效')
    } catch {
      message.error('切换失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const nameOf = (value: PayChannel) =>
    list.find((item) => item.value === value)?.name || (value === 'xunhupay' ? '虎皮椒' : '蓝兔（旧通道）')

  const statusTag = () => {
    if (checking) return <Tag>检查中…</Tag>
    if (configured === true) {
      return (
        <Tag color="green" icon={<CheckCircleFilled />}>
          后端配置正常
        </Tag>
      )
    }
    if (configured === false) {
      return (
        <Tag color="red" icon={<ExclamationCircleFilled />}>
          后端未配置
        </Tag>
      )
    }
    return <Tag>状态未知</Tag>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>支付方式</h1>
          <p>决定所有用户充值时走哪个支付通道。保存后全站生效，已打开的页面刷新一次即可拿到新配置。</p>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} disabled={saving} onClick={() => void loadChannel()}>
          重新读取
        </Button>
      </header>

      {error ? <Alert showIcon type="error" message={error} className={styles.alert} /> : null}

      <div className={styles.notice}>
        <IconBadge icon={<SafetyCertificateOutlined />} tone="amber" size="sm" />
        <div>
          <strong>切换前须知</strong>
          <p>通道来自后端全局配置，改的是「所有人」的付款入口。正在付款的用户不受影响，返回旧页面会继续用旧通道完成。</p>
        </div>
      </div>

      <Spin spinning={loading}>
        <div className={styles.grid} role="radiogroup" aria-label="支付通道">
          {list.map((item) => {
            const meta = CHANNEL_META[item.value]
            const selected = draft === item.value
            return (
              <div
                key={item.value}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                className={[styles.card, selected ? styles.cardActive : ''].filter(Boolean).join(' ')}
                onClick={() => setDraft(item.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setDraft(item.value)
                  }
                }}
              >
                <div className={styles.cardHead}>
                  <IconBadge
                    icon={item.value === 'xunhupay' ? <MoneyCollectFilled /> : <WalletOutlined />}
                    tone={item.value === 'xunhupay' ? 'brand' : 'violet'}
                    size="lg"
                  />
                  <div className={styles.cardTitle}>
                    <strong>{item.name}</strong>
                    <span className={styles.api}>{meta?.api}</span>
                  </div>
                  <div className={styles.tags}>
                    {channel === item.value ? <Tag color="blue">当前生效</Tag> : null}
                    {selected && draft !== channel ? <Tag color="gold">未保存</Tag> : null}
                    {item.value === 'xunhupay' ? statusTag() : null}
                  </div>
                </div>
                <p className={styles.desc}>{meta?.desc}</p>
              </div>
            )
          })}
        </div>
      </Spin>

      <div className={styles.actions}>
        <Button
          type="primary"
          loading={saving}
          disabled={loading || draft === channel}
          onClick={() => void save()}
        >
          保存并全站生效
        </Button>
        <span className={styles.actionsHint}>
          {draft === channel
            ? '当前已是这个通道'
            : `将从「${nameOf(channel)}」切到「${nameOf(draft)}」`}
        </span>
      </div>

      <section className={styles.checkCard}>
        <div className={styles.checkHead}>
          <IconBadge icon={<SafetyCertificateOutlined />} tone="mint" size="sm" />
          <strong>虎皮椒配置自检</strong>
          {statusTag()}
          <Button size="small" type="link" loading={checking} onClick={() => void checkXuHuPay()}>
            重新检查
          </Button>
        </div>
        <p className={styles.checkDesc}>
          检查后端 .env 里的 XUNHUPAY_APPID / XUNHUPAY_APPSECRET 是否已配置。缺配置时用户下单会失败，请先补齐并重启后端再切到虎皮椒。
        </p>
        {gateway ? (
          <p className={styles.gateway}>
            网关地址：<span className={styles.mono}>{gateway}</span>
          </p>
        ) : null}
        {configured === false && missing.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            className={styles.alert}
            message={`后端缺少配置：${missing.join('、')}`}
            description="在 gpt_backend 的 .env 补齐后重启服务，再点「重新检查」。"
          />
        ) : null}
      </section>
    </div>
  )
}

export default AdminPayChannel
