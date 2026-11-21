import { useEffect, useMemo, useRef, useState } from 'react'
import UserInfoCard from '@/components/UserInfoCard'
import styles from './index.module.less'
import { userStore, paymentStore } from '@/store'
import {
  Alert,
  Image,
  Spin,
  Button,
  InputNumber,
  Modal,
  Pagination,
  Space,
  Table,
  Tag,
  message
} from 'antd'
import {
  userBillList,
  userBillInfo,
  getUserPricing,
  createXuHuPayOrder,
  queryXuHuPayOrder,
  type UserModelRate
} from '@/request/api'
import OpenAiLogo from '@/components/OpenAiLogo'
import { getInvoiceList, type InvoiceRecord, type InvoiceStatus } from '@/request/invoice'
import { useNavigate } from 'react-router-dom'
import { getAliPayPage } from '../../request/api'
import {
  isPayOk,
  normalizePayload,
  payErrorMessage,
  readPendingOrder,
  savePendingOrder
} from '@/utils/payment'
import {
  PROVIDER_META,
  enrichVendorModel,
  formatUsd,
  pickFeaturedModelIds
} from '@/data/modelPricing'

type FeaturedCard = {
  id: string
  name: string
  provider: keyof typeof PROVIDER_META
  inputUsd: number
  outputUsd: number
  cachedInputUsd: number
  intro?: string
}

const supportPhone = import.meta.env.VITE_SUPPORT_PHONE || ''

type BillRow = {
  bill_id: string
  generate_time: string
  pay: number
  function_name: string
  /** 后端若在账单里直接带开票状态，前端优先用它 */
  invoice_status?: InvoiceStatus | 'none'
  invoice_id?: number
}

function formatBillTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

const INVOICE_STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  issuing: { label: '开票中', color: 'blue' },
  issued: { label: '已开票', color: 'green' },
  rejected: { label: '已驳回', color: 'red' }
}

type PayModalState = {
  loading: boolean
  visiblePop: boolean
  url: string
  code_num: string
  request_id: string
  /** 本次充值金额，弹窗里给用户对账用 */
  amount: number
}

const emptyPayModal = (): PayModalState => ({
  loading: false,
  visiblePop: false,
  url: '',
  code_num: '',
  request_id: '',
  amount: 0
})

export function ShopPanel() {
  const navigate = useNavigate()
  const { token, user_info, llm_api_key } = userStore()
  const phone =
    (user_info as any)?.data?.bodyMessage?.telephone || (user_info as any)?.telephone || ''
  const credential =
    (llm_api_key || '').startsWith('sk-') || /^1[3-9]\d{9}$/.test(llm_api_key || '')
      ? llm_api_key
      : phone
  const [featuredPrices, setFeaturedPrices] = useState<FeaturedCard[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [billList, setBillList] = useState<BillRow[]>([])
  const [billsLoading, setBillsLoading] = useState(false)
  const [billsError, setBillsError] = useState(false)
  const [tableObj, setTableObj] = useState({
    current: 1,
    pageSize: 5
  })
  const [num4, set4Num] = useState(0)
  const [moneyObj, setMoneyObj] = useState<PayModalState>(emptyPayModal())
  const [askNum, setAskNum] = useState(0)
  const [listTotal, setListTotal] = useState(0)
  const [updata, setUpdata] = useState({})
  const [customAmount, setCustomAmount] = useState<number | null>(null)
  const paymentChannel = paymentStore((state) => state.channel)
  const [payOrder, setPayOrder] = useState<{
    outTradeNo: string
    payType: string
    amount: number
  } | null>(null)
  const [invoiceRecords, setInvoiceRecords] = useState<InvoiceRecord[]>([])
  const [invoiceReady, setInvoiceReady] = useState(true)
  const recordsRef = useRef<HTMLDivElement | null>(null)
  const rechargeRef = useRef<HTMLDivElement | null>(null)
  const accountId = String(user_info?.data?.bodyMessage?.userId || '')
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    const pending = readPendingOrder()
    if (token && pending?.awaitingReturn && (!pending.userId || pending.userId === accountId)) {
      savePendingOrder({ ...pending, awaitingReturn: false })
      navigate('/result', { replace: true })
    }
  }, [token, navigate, accountId])
  const creating = useRef(false)
  const getPostMoney = async (value: number) => {
    const userId = user_info?.data?.bodyMessage?.userId
    if (!token || !userId || creating.current) return
    const pending = readPendingOrder()
    if (pending && (!pending.userId || pending.userId === accountId)) {
      navigate('/result')
      return
    }
    if (!Number.isInteger(value) || value <= 0 || value > 100000) {
      message.warning('请输入 1–100000 元的整数金额')
      return
    }
    creating.current = true
    setPayOrder(null)
    setMoneyObj({ ...emptyPayModal(), loading: true, visiblePop: true, amount: value })
    if (paymentChannel === 'xunhupay') {
      try {
        const res: any = await createXuHuPayOrder({
          userId,
          money: value,
          function_code: 'chatGpt',
          pay_type: 'auto'
        })
        const data = normalizePayload<any>(res)
        if (!isPayOk(res)) {
          message.error(payErrorMessage(res, '下单失败，请稍后重试'))
          setMoneyObj(emptyPayModal())
          return
        }
        if (!data.outTradeNo) throw new Error('渠道未返回订单号')
        savePendingOrder({
          outTradeNo: data.outTradeNo,
          channel: 'xunhupay',
          money: value,
          createdAt: Date.now(),
          userId: accountId,
          awaitingReturn: data.payType === 'h5'
        })
        if (data.payType === 'h5') {
          setMoneyObj(emptyPayModal())
          window.location.href = data.payUrl
          return
        }
        setPayOrder({ outTradeNo: data.outTradeNo, payType: data.payType, amount: value })
        setMoneyObj({
          loading: false,
          visiblePop: true,
          url: data.payUrl || '',
          code_num: '',
          request_id: '',
          amount: value
        })
      } catch {
        message.error('下单结果尚未确认，请先查看钱包的订单记录')
        setMoneyObj(emptyPayModal())
        setUpdata({})
      } finally {
        creating.current = false
      }
      return
    }
    try {
      const res: any = await getAliPayPage({
        money: value,
        userId,
        function_code: 'chatGpt'
      })
      const data = res.data?.payUrl || {}
      const {
        code_num,
        request_id,
        data: { QRcode_url }
      } = data
      if (!code_num) throw new Error('渠道未返回订单号')
      savePendingOrder({
        outTradeNo: String(code_num),
        channel: 'lantu',
        money: value,
        createdAt: Date.now(),
        userId: accountId
      })
      setMoneyObj({
        loading: false,
        visiblePop: true,
        url: QRcode_url || '',
        code_num,
        request_id,
        amount: value
      })
    } catch {
      message.error('下单结果尚未确认，请先查看钱包的订单记录')
      setMoneyObj(emptyPayModal())
      setUpdata({})
    } finally {
      creating.current = false
    }
  }
  const handleOk = () => {
    if (readPendingOrder()) navigate('/result')
  }
  const handleCancel = () => {
    setPayOrder(null)
    setMoneyObj(emptyPayModal())
  }
  // 虎皮椒二维码弹出后自动轮询，最多 10 分钟；成功后自动关弹窗并刷新余额。
  useEffect(() => {
    if (paymentChannel !== 'xunhupay' || !payOrder || !moneyObj.visiblePop) return
    const startedAt = Date.now()
    let stopped = false
    const timer = setInterval(() => {
      if (stopped) return
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        clearInterval(timer)
        return
      }
      queryXuHuPayOrder(payOrder.outTradeNo)
        .then((res: any) => {
          if (stopped) return
          if (normalizePayload<any>(res).paid) {
            stopped = true
            clearInterval(timer)
            navigate('/result')
          }
        })
        .catch(() => null)
    }, 4000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [payOrder, moneyObj.visiblePop, paymentChannel])
  const handleCustomRecharge = () => {
    if (customAmount == null || !Number.isInteger(customAmount) || customAmount <= 0) {
      message.warning('请输入 1–100000 元的整数金额')
      setCustomAmount(null)
      return
    }
    getPostMoney(customAmount)
  }
  const renderMoneyList = () => {
    return [1, 10, 20, 50, 100].map((money) => (
      <div className={styles.item} key={money} onClick={() => getPostMoney(money)}>
        <div className={styles.money_box}>{money}元</div>
      </div>
    ))
  }
  useEffect(() => {
    if (!token || !accountId) return
    let active = true
    userBillInfo({ userId: accountId })
      .then((res) => {
        if (active && res.code === 0 && res.data?.userMessage) {
          setAskNum(res.data.userMessage.token)
          set4Num(res.data.userMessage.plus_user_count)
        }
      })
      .catch(() => {
        if (active) message.error('暂时无法读取余额')
      })
    return () => {
      active = false
    }
  }, [token, accountId, updata])
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const sync = () => setIsNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // 开票记录：按订单号映射到支付记录，用来显示「未开 / 审核中 / 已开票 / 已驳回」。
  useEffect(() => {
    if (!token) return
    let cancelled = false
    getInvoiceList({ page: 1, page_num: 50 })
      .then((res: any) => {
        if (cancelled) return
        const payload = res?.data || {}
        setInvoiceRecords(Array.isArray(payload.list) ? payload.list : [])
        setInvoiceReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setInvoiceRecords([])
        setInvoiceReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, updata])

  const invoiceByBill = useMemo(() => {
    const priority: Record<string, number> = { issued: 4, issuing: 3, pending: 2, rejected: 1 }
    const map = new Map<string, InvoiceRecord>()
    for (const record of invoiceRecords) {
      const ids = String(record.bill_id || record.order_no || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
      for (const id of ids) {
        const previous = map.get(id)
        if (!previous || (priority[record.status] || 0) > (priority[previous.status] || 0))
          map.set(id, record)
      }
    }
    return map
  }, [invoiceRecords])

  const renderInvoiceCell = (record: BillRow) => {
    const invoice = invoiceByBill.get(String(record.bill_id))
    const status =
      invoice?.status ||
      (record.invoice_status && record.invoice_status !== 'none'
        ? record.invoice_status
        : undefined)
    if (status === 'rejected') {
      return (
        <span className={styles.invoiceCell}>
          <Tag color={INVOICE_STATUS_META.rejected.color}>已驳回</Tag>
          {invoiceReady ? (
            <Button
              size="small"
              type="link"
              onClick={() => navigate(`/invoice?order=${encodeURIComponent(record.bill_id)}`)}
            >
              重新申请
            </Button>
          ) : null}
        </span>
      )
    }
    if (status) {
      const meta = INVOICE_STATUS_META[status]
      return <Tag color={meta?.color}>{meta?.label || status}</Tag>
    }
    if (!invoiceReady) {
      return <span className={styles.invoiceMuted}>开票服务暂不可用</span>
    }
    return (
      <Button
        size="small"
        type="link"
        onClick={() => navigate(`/invoice?order=${encodeURIComponent(record.bill_id)}`)}
      >
        开发票
      </Button>
    )
  }

  useEffect(() => {
    if (!token || !accountId) return
    let cancelled = false
    setBillsLoading(true)
    setBillsError(false)
    userBillList({ page: tableObj.current, userId: Number(accountId), page_num: tableObj.pageSize })
      .then((res) => {
        if (cancelled) return
        if (res?.code !== 0 || !Array.isArray(res.data?.user_bill_list))
          throw new Error('读取支付记录失败')
        setBillList(res.data.user_bill_list)
        setListTotal(Number(res.data.totalNum || 0))
      })
      .catch(() => {
        if (!cancelled) setBillsError(true)
      })
      .finally(() => {
        if (!cancelled) setBillsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, tableObj, token, updata])

  // 热门模型：只展示当前供应商实际有的，并取最新推荐
  useEffect(() => {
    if (!token || !credential) {
      setFeaturedPrices([])
      return
    }
    const controller = new AbortController()
    setFeaturedLoading(true)
    getUserPricing({ signal: controller.signal })
      .then((data) => {
        const grouped = new Map<string, UserModelRate[]>()
        for (const item of data.models || []) {
          if (!item?.model) continue
          if (!grouped.has(item.model)) grouped.set(item.model, [])
          grouped.get(item.model)!.push(item)
        }
        const ids = data.model_ids?.length
          ? data.model_ids.filter((id) => grouped.has(id))
          : [...grouped.keys()]
        for (const id of grouped.keys()) {
          if (!ids.includes(id)) ids.push(id)
        }
        const featuredIds = pickFeaturedModelIds(ids, 3)
        setFeaturedPrices(
          featuredIds.map((id) => {
            const rates = grouped.get(id) || []
            const standard = rates.find((r) => r.service_tier === 'standard') || rates[0]
            const enriched = enrichVendorModel({
              id,
              name: rates[0]?.display_name,
              owned_by: rates[0]?.owned_by
            })
            return {
              id,
              name: enriched.name,
              provider: enriched.provider,
              inputUsd: Number(standard?.input || 0),
              outputUsd: Number(standard?.output || 0),
              cachedInputUsd: Number(standard?.cache_read || 0),
              intro: enriched.intro
            }
          })
        )
      })
      .catch(() => setFeaturedPrices([]))
      .finally(() => setFeaturedLoading(false))
    return () => controller.abort()
  }, [token, credential])

  const featuredHint = useMemo(() => {
    if (!featuredPrices.length) return '跟随当前供应商最新可用模型'
    return featuredPrices.map((item) => item.name).join(' · ')
  }, [featuredPrices])

  if (!token) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <OpenAiLogo rotate width="3em" height="3em" />
      </div>
    )
  }
  return (
    <div className={styles.shopPanel}>
      <Modal
        title="义乌市妮兔网络科技工作室"
        open={moneyObj.visiblePop}
        onOk={handleOk}
        onCancel={handleCancel}
        okText="查询支付结果"
        okButtonProps={{ disabled: moneyObj.loading }}
        cancelText="稍后再付"
        width={420}
        centered
      >
        <div className={styles.payModalBody}>
          <div className={styles.payAmountRow}>
            <span>本次充值</span>
            <strong>¥{moneyObj.amount.toFixed(2)}</strong>
          </div>
          <div className={styles.qrShell}>
            <Spin spinning={moneyObj.loading}>
              {moneyObj.url ? (
                <Image
                  preview={false}
                  width={200}
                  height={200}
                  src={moneyObj.url}
                  alt="支付二维码"
                />
              ) : (
                <div className={styles.qrPlaceholder}>
                  {moneyObj.loading ? '正在生成二维码…' : '二维码暂未生成，请重试'}
                </div>
              )}
            </Spin>
          </div>
          <p className={styles.payHint}>请用微信「扫一扫」完成支付，支付成功后余额自动到账</p>
          {supportPhone && (
            <p className={styles.paySupport}>
              支付遇到问题？联系客服 <a href={`tel:${supportPhone}`}>{supportPhone}</a>
            </p>
          )}
        </div>
      </Modal>
      <div className={styles.goodsPay_container}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <UserInfoCard
            info={user_info}
            variant="wallet"
            data={{ num4, num: askNum }}
            onRecharge={() => {
              const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
              rechargeRef.current?.scrollIntoView({
                behavior: reduceMotion ? 'auto' : 'smooth',
                block: 'start'
              })
            }}
          />
          {/* 卡密充值区 */}
          <div
            className={styles.goodsPay_card}
            ref={rechargeRef}
            style={{ scrollMarginTop: 'calc(var(--header-h) + 16px)' }}
          >
            <h4>
              {paymentChannel === 'xunhupay'
                ? '充多少到账多少：手机端自动跳转微信支付，电脑端扫码支付。'
                : '充多少到账多少：电脑端扫码支付，手机端可保存二维码后在微信扫码。'}
            </h4>
            <div className={styles.goodsPay_card_item_box}>{renderMoneyList()}</div>
            <div className={styles.customRecharge}>
              <div>
                <strong>自定义金额</strong>
                <p>只能充值大于 0 的整数，单位：元</p>
              </div>
              <div className={styles.customRecharge_form}>
                <InputNumber
                  min={1}
                  max={100000}
                  step={1}
                  precision={0}
                  value={customAmount ?? undefined}
                  placeholder="输入整数金额"
                  addonAfter="元"
                  controls
                  parser={(value) => {
                    const text = String(value ?? '')
                    if (text.trim().startsWith('-')) return '' as unknown as number
                    const intPart = text.replace(/[^\d.]/g, '').split('.')[0]
                    if (!intPart) return '' as unknown as number
                    const amount = Number(intPart)
                    return amount > 0 ? amount : ('' as unknown as number)
                  }}
                  onChange={(value) => {
                    if (value == null || value === ('' as unknown as number)) {
                      setCustomAmount(null)
                      return
                    }
                    const amount = Math.floor(Number(value))
                    setCustomAmount(Number.isFinite(amount) && amount > 0 ? amount : null)
                  }}
                  onPressEnter={handleCustomRecharge}
                />
                <Button type="primary" onClick={handleCustomRecharge}>
                  自定义充值
                </Button>
              </div>
            </div>
          </div>
          <div className={styles.goodsPay_card}>
            <h4 className={styles.priceTitle}>
              <span>热门模型价格（当前供应商 · 美元 / 百万 tokens）</span>
              <Button type="link" onClick={() => navigate('/price')}>
                查看完整价目
              </Button>
            </h4>
            <p style={{ margin: '0 0 12px', color: '#667085', fontSize: 13 }}>
              {featuredLoading ? '正在读取当前供应商价目…' : featuredHint}
            </p>
            <div className={styles.pricePreview}>
              {featuredPrices.map((item) => (
                <div
                  className={styles.pricePreviewItem}
                  key={item.id}
                  onClick={() => navigate('/price')}
                >
                  <span className={styles.priceProvider}>{PROVIDER_META[item.provider].label}</span>
                  <strong>{item.name}</strong>
                  <div>输入 {formatUsd(item.inputUsd)}</div>
                  <div>输出 {formatUsd(item.outputUsd)}</div>
                  <div>缓存命中 {formatUsd(item.cachedInputUsd)}</div>
                  {item.intro ? (
                    <div style={{ marginTop: 6, color: '#98a2b3', fontSize: 12 }}>{item.intro}</div>
                  ) : null}
                </div>
              ))}
              {!featuredLoading && featuredPrices.length === 0 ? (
                <div style={{ color: '#98a2b3', fontSize: 13 }}>
                  暂无可用模型价目，请稍后在「模型价格」页查看
                </div>
              ) : null}
            </div>
          </div>
          <div className={styles.goodsPay_card} ref={recordsRef}>
            <h4 className={styles.priceTitle}>
              <span>支付记录</span>
              {readPendingOrder() && (
                <Button onClick={() => navigate('/result')}>查询原订单</Button>
              )}
              <Button type="link" loading={billsLoading} onClick={() => setUpdata({})}>
                刷新
              </Button>
            </h4>
            {billsError && (
              <Alert
                showIcon
                type="error"
                message="暂时无法读取支付记录"
                action={
                  <Button size="small" onClick={() => setUpdata({})}>
                    重试
                  </Button>
                }
              />
            )}
            <p className={styles.recordHint}>
              每笔充值可开一张电子普通发票；一单一票，已开票的订单不能重复申请。
            </p>
            {isNarrow ? (
              <div className={styles.billCards}>
                {billList.length === 0 && !billsError && (
                  <div className={styles.billEmpty} role="status">
                    {billsLoading ? '正在读取支付记录…' : '还没有支付记录'}
                  </div>
                )}
                {billList.map((bill) => (
                  <article className={styles.billCard} key={bill.bill_id}>
                    <div className={styles.billInfo}>
                      <span className={styles.orderNo}>{bill.bill_id}</span>
                      <span className={styles.mobileDate}>
                        {formatBillTime(bill.generate_time)}
                      </span>
                      <span className={styles.billUse}>{bill.function_name}</span>
                    </div>
                    <div className={styles.billActions}>
                      <span className={styles.payAmount}>¥{Number(bill.pay || 0).toFixed(2)}</span>
                      {renderInvoiceCell(bill)}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Table
                scroll={{ x: 920 }}
                bordered
                loading={billsLoading}
                dataSource={billList}
                pagination={false}
                rowKey="bill_id"
                columns={[
                  {
                    title: '订单号',
                    dataIndex: 'bill_id',
                    key: 'bill_id',
                    render: (value: string) => <span className={styles.orderNo}>{value}</span>
                  },
                  {
                    title: '用途',
                    key: 'function_name',
                    dataIndex: 'function_name'
                  },
                  {
                    title: '日期',
                    dataIndex: 'generate_time',
                    key: 'generate_time',
                    render: (value: string) => (
                      <span className={styles.billTime}>{formatBillTime(value)}</span>
                    )
                  },
                  {
                    title: '金额',
                    dataIndex: 'pay',
                    key: 'pay',
                    render: (value: number) => (
                      <span className={styles.payAmount}>¥{Number(value || 0).toFixed(2)}</span>
                    )
                  },
                  {
                    title: '发票',
                    key: 'invoice',
                    width: 150,
                    render: (_: unknown, record: BillRow) => renderInvoiceCell(record)
                  }
                ]}
              />
            )}
            <div className={styles.goodsPay_pagination}>
              <Pagination
                size="small"
                current={tableObj.current}
                pageSize={tableObj.pageSize}
                total={listTotal}
                onChange={(current, pageSize) => {
                  setTableObj({ current, pageSize })
                }}
              />
            </div>
          </div>
        </Space>
      </div>
    </div>
  )
}

export default ShopPanel
