import { useEffect, useMemo, useRef, useState } from 'react'
import UserInfoCard from '@/components/UserInfoCard'
import styles from './index.module.less'
import { userStore, paymentStore } from '@/store'
import {Image,Spin, Button, InputNumber, Modal, Pagination, Space, Table, Tag, message } from 'antd'
import {
  userBillList,
  userBillInfo,
  getUserPricing,
  createXuHuPayOrder,
  queryXuHuPayOrder,
  type UserModelRate
} from '@/request/api'
import OpenAiLogo from '@/components/OpenAiLogo'
import InvoiceApplyModal, { type InvoiceBill } from '@/components/InvoiceApplyModal'
import { getInvoiceList, type InvoiceRecord, type InvoiceStatus } from '@/request/invoice'
import { useNavigate } from 'react-router-dom'
import {getAliPayPage,payVerify}from '../../request/api'
import {
  clearPendingOrder,
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
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
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
  const { token, user_info, llm_api_key } = userStore();
  const phone =
    (user_info as any)?.data?.bodyMessage?.telephone ||
    (user_info as any)?.telephone ||
    ''
  const credential =
    (llm_api_key || '').startsWith('sk-') || /^1[3-9]\d{9}$/.test(llm_api_key || '')
      ? llm_api_key
      : phone
  const [featuredPrices, setFeaturedPrices] = useState<FeaturedCard[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [billList,setBillList] = useState<BillRow[]>([]);
  const [tableObj,setTableObj] = useState({
    current:1,
    pageSize:5,
  })
  const [num4,set4Num] = useState(0)
  const [moneyObj,setMoneyObj] = useState<PayModalState>(emptyPayModal())
  const [askNum,setAskNum]=useState(0);
  const [listTotal,setListTotal] = useState(0);
  const [updata,setUpdata] = useState({});
  const [customAmount, setCustomAmount] = useState<number | null>(null)
  const paymentChannel = paymentStore((state) => state.channel)
  const [payOrder, setPayOrder] = useState<{ outTradeNo: string; payType: string; amount: number } | null>(null)
  const [invoiceRecords, setInvoiceRecords] = useState<InvoiceRecord[]>([])
  const [invoiceReady, setInvoiceReady] = useState(true)
  const [invoiceTarget, setInvoiceTarget] = useState<InvoiceBill | null>(null)
  const [paySuccess, setPaySuccess] = useState<{ amount: number } | null>(null)
  const recordsRef = useRef<HTMLDivElement | null>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  const getPostMoney = async (value: number) => {
    if (!Number.isInteger(value) || value <= 0) {
      message.warning('充值金额必须是大于 0 的整数')
      return
    }
    const userId = user_info?.data?.bodyMessage?.userId
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
        if (data.payType === 'h5') {
          // 手机端直接跳转，订单号先落盘，回来后查单确认。
          savePendingOrder({
            outTradeNo: data.outTradeNo,
            channel: 'xunhupay',
            money: value,
            createdAt: Date.now()
          })
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
        message.error('网络异常，下单失败，请稍后重试')
        setMoneyObj(emptyPayModal())
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
      const { code_num, request_id, data: { QRcode_url } } = data
      setMoneyObj({
        loading: false,
        visiblePop: true,
        url: QRcode_url || '',
        code_num,
        request_id,
        amount: value
      })
    } catch {
      message.error('网络异常，下单失败，请稍后重试')
      setMoneyObj(emptyPayModal())
    }
  }
  const finishPaid = (tip: string, amount?: number) => {
    message.success(tip)
    clearPendingOrder()
    setPayOrder(null)
    setMoneyObj(emptyPayModal())
    setUpdata({})
    if (amount && amount > 0) setPaySuccess({ amount })
  }
  const handleOk = async () => {
    if (paymentChannel === 'xunhupay') {
      if (!payOrder) return
      try {
        const res: any = await queryXuHuPayOrder(payOrder.outTradeNo)
        if (normalizePayload<any>(res).paid) {
          finishPaid('支付成功，余额已到账', payOrder.amount)
        } else {
          message.info('还没收到支付结果，完成支付后会自动到账')
        }
      } catch {
        message.error('查单失败，请稍后在「订单记录」核对')
      }
      return
    }
    try {
      const res: any = await payVerify({ codeNum: moneyObj.code_num })
      if (isPayOk(res)) {
        finishPaid('支付成功', moneyObj.amount)
      } else {
        message.info('还没收到支付结果，完成支付后会自动到账')
      }
    } catch {
      message.error('查单失败，请稍后在「订单记录」核对')
    }
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
            finishPaid('支付成功，余额已到账', payOrder.amount)
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
      message.warning('充值金额必须是大于 0 的整数')
      setCustomAmount(null)
      return
    }
    getPostMoney(customAmount)
  }
  const renderMoneyList=()=>{
    const moneyInfoList =[
      {day:"",money:1,level:'',Describe:"体验一下gpt。"},
      {day:"",money:10,level:'',Describe:"攒着\n够用好多次了\n适合轻量用户。"},
      // {day:30,money:20,level:'gpt3.5购买',Describe:"享受\n1.gpt3.5免费使用",bigMoney:25},
      // {day:30,money:69.9,level:'gpt4购买',Describe:"享受\n1.gpt4免费使用",bigMoney:140},
      {day:"",money:20,level:'',Describe:"主打一个双倍享受"},
      {day:"",money:50,level:'',Describe:"中度使用用户\n基本满足gpt4的需求\n实现3.5自由。"},
      {day:"",money:100,level:'',Describe:"gpt4随便用\n3.5不屑一顾。"}
      
      // {day:90,money:89.9,level:'季度购买',Describe:"享受\n1.gpt3.5免费使用\n2.gpt4每天30次",bigMoney:105},
      // {day:180,money:169.9,level:'半年购买',Describe:"享受\n1.gpt3.5免费使用\n2.gpt4每天36次",bigMoney:190}, 
      // {day:365,money:269.9,level:'包年购买',Describe:"享受\n1.gpt3.5免费使用\n2.gpt4每天88次",bigMoney:420},
    ]
    return moneyInfoList.map((value:any)=>{
      return (
        <div className={styles.item} key={value.money} onClick={()=>{getPostMoney(value.money)}}>
          <span className={styles.level}>{value.level}</span>
          <div className={styles.days}>
            {value.day}
          </div>
          <div className={styles.money_box}>
            {value.money}元<span className={styles.old_money}>{value.bigMoney}</span>
          </div>
          <span className={styles.describe}>
            {value.Describe}
          </span>
        </div>
      )
    })
  }
  // 手机 H5 支付会跳走再回来，页面重新加载后凭落盘订单号自动确认（最多等 30 秒）。
  useEffect(() => {
    const pending = readPendingOrder()
    if (!pending || paymentChannel !== 'xunhupay' || !token) return
    let stopped = false
    let tries = 0
    let timer: ReturnType<typeof setInterval> | null = null
    const check = () => {
      queryXuHuPayOrder(pending.outTradeNo)
        .then((res: any) => {
          if (stopped) return
          if (normalizePayload<any>(res).paid) {
            stopped = true
            if (timer) clearInterval(timer)
            finishPaid('支付成功，余额已到账', pending.money)
            return
          }
          tries += 1
          if (tries >= 8) {
            if (timer) clearInterval(timer)
            message.info('支付结果还在确认中，稍后刷新页面可看到最新余额')
          }
        })
        .catch(() => null)
    }
    timer = setInterval(check, 4000)
    check()
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
    }
  }, [paymentChannel, token])
  useEffect(()=>{
    userBillInfo({userId:user_info?.data?.bodyMessage?.userId}).then((res)=>{
      console.log(res);
      if(res.code===0){
        console.log(res);
        setAskNum(res.data.userMessage.token)
        set4Num(res.data.userMessage.plus_user_count)
      }
    })
  },[updata])
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
      const key = String(record.bill_id || record.order_no || '')
      if (!key) continue
      const prev = map.get(key)
      if (!prev || (priority[record.status] || 0) > (priority[prev.status] || 0)) {
        map.set(key, record)
      }
    }
    return map
  }, [invoiceRecords])

  const renderInvoiceCell = (record: BillRow) => {
    const invoice = invoiceByBill.get(String(record.bill_id))
    const status = invoice?.status || (record.invoice_status && record.invoice_status !== 'none' ? record.invoice_status : undefined)
    if (status === 'rejected') {
      return (
        <span className={styles.invoiceCell}>
          <Tag color={INVOICE_STATUS_META.rejected.color}>已驳回</Tag>
          {invoiceReady ? (
            <Button size="small" type="link" onClick={() => setInvoiceTarget(record)}>
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
      return <span className={styles.invoiceMuted}>开票服务未开通</span>
    }
    return (
      <Button size="small" type="link" onClick={() => setInvoiceTarget(record)}>
        开发票
      </Button>
    )
  }

  useEffect(() => {
    async function fetchUserBillList() {
      const params = {
        page:tableObj.current,
        userId:Number(user_info?.data?.bodyMessage?.userId),
        page_num:tableObj.pageSize
      }
      const res = await userBillList(params);
      if(res?.code === 0){
        setBillList(res.data.user_bill_list)
        setListTotal(res.data.totalNum)
      }
    }
    fetchUserBillList()
  }, [tableObj,updata])

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
          open={Boolean(paySuccess)}
          title="充值成功"
          onCancel={() => setPaySuccess(null)}
          /* 充值成功是营收漏斗上最关键的一屏：用户刚付完钱，最想知道
             「接下来怎么用」，而不是「怎么开发票」。
             原来这里唯一的按钮是「去支付记录开发票」，等于收完钱就把人送去
             办手续（2026-10-24 流程检验第 1 条：阻塞交易）。 */
          footer={[
            <Button
              key="invoice"
              onClick={() => {
                setPaySuccess(null)
                recordsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              去支付记录开发票
            </Button>,
            <Button
              key="guide"
              type="primary"
              onClick={() => {
                setPaySuccess(null)
                // 2026-10-24：充完钱第一件事是拿密钥去填软件，不是看教程。
                // 指向独立的接入页 /agent，打开就是地址和密钥。
                navigate('/agent')
              }}
            >
              去拿密钥并接入
            </Button>
          ]}
        >
          <p className={styles.successText}>
            ¥{Number(paySuccess?.amount || 0).toFixed(2)} 已到账，现在就能用了。
          </p>
          <p className={styles.successText}>
            下一步：去「接入」页生成一个密钥，填到你的软件里就能开始调用。
            <br />
            需要发票的话，在下方「支付记录」里对这笔充值申请，一单一票。
          </p>
        </Modal>
        <InvoiceApplyModal
          open={Boolean(invoiceTarget)}
          bill={invoiceTarget}
          defaultEmail={user_info?.data?.bodyMessage?.email || ''}
          onClose={() => setInvoiceTarget(null)}
          onSubmitted={() => setUpdata({})}
        />
        <Modal
          title="义乌市妮兔网络科技工作室"
          open={moneyObj.visiblePop}
          onOk={handleOk}
          onCancel={handleCancel}
          okText="我已完成支付"
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
                  <Image preview={false} width={200} height={200} src={moneyObj.url} alt="支付二维码" />
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
            {/* 用户信息 */}
            <UserInfoCard info={user_info} data={{num4:num4,num:askNum,avatar:user_info?.data?.bodyMessage?.userName.slice(0,1)}} />
            {/* 卡密充值区 */}
            <div className={styles.goodsPay_card}>
              <h4>
                {paymentChannel === 'xunhupay'
                  ? '充多少到账多少：手机端自动跳转微信支付，电脑端扫码支付。'
                  : '充多少到账多少：电脑端扫码支付，手机端可保存二维码后在微信扫码。'}
              </h4>
              <div className={styles.goodsPay_card_item_box}>
             {renderMoneyList()}
             </div>
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
                <Button type="link" onClick={() => navigate('/price')}>查看完整价目</Button>
              </h4>
              <p style={{ margin: '0 0 12px', color: '#667085', fontSize: 13 }}>
                {featuredLoading ? '正在读取当前供应商价目…' : featuredHint}
              </p>
              <div className={styles.pricePreview}>
                {featuredPrices.map((item) => (
                  <div className={styles.pricePreviewItem} key={item.id} onClick={() => navigate('/price')}>
                    <span className={styles.priceProvider}>{PROVIDER_META[item.provider].label}</span>
                    <strong>{item.name}</strong>
                    <div>输入 {formatUsd(item.inputUsd)}</div>
                    <div>输出 {formatUsd(item.outputUsd)}</div>
                    <div>缓存命中 {formatUsd(item.cachedInputUsd)}</div>
                    {item.intro ? <div style={{ marginTop: 6, color: '#98a2b3', fontSize: 12 }}>{item.intro}</div> : null}
                  </div>
                ))}
                {!featuredLoading && featuredPrices.length === 0 ? (
                  <div style={{ color: '#98a2b3', fontSize: 13 }}>暂无可用模型价目，请稍后在「模型价格」页查看</div>
                ) : null}
              </div>
            </div>
            <div className={styles.goodsPay_card} ref={recordsRef}>
              <h4 className={styles.priceTitle}>
                <span>支付记录</span>
                <Button type="link" onClick={() => setUpdata({})}>
                  刷新
                </Button>
              </h4>
              <p className={styles.recordHint}>每笔充值可开一张电子普通发票；一单一票，已开票的订单不能重复申请。</p>
              {isNarrow ? (
                <div className={styles.billCards}>
                  {billList.length === 0 ? <div className={styles.billEmpty}>还没有支付记录</div> : null}
                  {billList.map((bill) => (
                    <article className={styles.billCard} key={bill.bill_id}>
                      <div className={styles.billInfo}>
                        <span className={styles.orderNo}>{bill.bill_id}</span>
                        <span className={styles.mobileDate}>{formatBillTime(bill.generate_time)}</span>
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
                  loading={false}
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
                      render: (value: string) => <span className={styles.billTime}>{formatBillTime(value)}</span>
                    },
                    {
                      title: '金额',
                      dataIndex: 'pay',
                      key: 'pay',
                      render: (value: number) => <span className={styles.payAmount}>¥{Number(value || 0).toFixed(2)}</span>
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
                    console.log(current, pageSize);
                    setTableObj({current,pageSize})
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
