import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Pagination, Select, Spin, Tag, message } from 'antd'
import { FileTextOutlined, HistoryOutlined, ReloadOutlined, WalletOutlined } from '@ant-design/icons'
import IconBadge from '@/components/IconBadge'
import InvoiceApplyModal, { type InvoiceBill } from '@/components/InvoiceApplyModal'
import { userBillList } from '@/request/api'
import { userStore } from '@/store'
import {
  cancelInvoice,
  getInvoiceList,
  getInvoiceSummary,
  type InvoiceRecord,
  type InvoiceStatus,
  type InvoiceSummary
} from '@/request/invoice'
import styles from './index.module.less'

/**
 * 发票中心（2026-10-24 起独立成栏目 /invoice）
 * ------------------------------------------------------------
 * 站长要求：发票必须对应「某一笔已支付的充值」，不能在任意页面随手开。
 * 这里把充值记录直接搬进来：上面是开票说明，下面是充值记录，
 * 点某一笔的「开发票」，金额和订单号自动带进弹窗。一单一票。
 */

const STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  issuing: { label: '开票中', color: 'blue' },
  issued: { label: '已开票', color: 'green' },
  rejected: { label: '已驳回', color: 'red' }
}

const PAGE_SIZE = 8

const EMPTY_SUMMARY: InvoiceSummary = {
  recharge_total: 0,
  issued_amount: 0,
  pending_amount: 0,
  invoiceable_amount: 0
}

function money(value?: number | null) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function formatTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function InvoicePanel() {
  const [summary, setSummary] = useState<InvoiceSummary>(EMPTY_SUMMARY)
  const [records, setRecords] = useState<InvoiceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [backendReady, setBackendReady] = useState(true)

  const [bills, setBills] = useState<InvoiceBill[]>([])
  const [billsLoading, setBillsLoading] = useState(false)
  const [invoiceTarget, setInvoiceTarget] = useState<InvoiceBill | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const { user_info } = userStore()
  const userEmail = (user_info as any)?.data?.bodyMessage?.email || ''
  const userId = Number((user_info as any)?.data?.bodyMessage?.userId || 0)

  /** 订单号 → 已有开票记录，用来在充值记录里显示「待审核/已开票/已驳回」 */
  const invoiceByBill = useMemo(() => {
    const priority: Record<string, number> = { issued: 4, issuing: 3, pending: 2, rejected: 1 }
    const map = new Map<string, InvoiceRecord>()
    for (const record of records) {
      const key = String(record.bill_id || record.order_no || '')
      if (!key) continue
      const prev = map.get(key)
      if (!prev || (priority[record.status] || 0) > (priority[prev.status] || 0)) map.set(key, record)
    }
    return map
  }, [records])

  const loadAll = useCallback(async (nextPage = 1, nextStatus: InvoiceStatus | 'all' = status) => {
    setLoading(true)
    try {
      const [summaryRes, listRes] = await Promise.all([
        getInvoiceSummary(),
        getInvoiceList({ page: nextPage, page_num: PAGE_SIZE, status: nextStatus })
      ])
      const sum = (summaryRes as any)?.data || {}
      setSummary({ ...EMPTY_SUMMARY, ...sum })
      const payload = (listRes as any)?.data || {}
      setRecords(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
      setBackendReady(true)
    } catch {
      // 接口还没部署：静默展示空态，别把技术错误甩给用户
      setBackendReady(false)
      setRecords([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void loadAll(1, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, refreshKey])

  // 充值记录：和充值商城共用同一个接口
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setBillsLoading(true)
    userBillList({ userId, page: 1, page_num: 50 })
      .then((res: any) => {
        if (cancelled) return
        const rows = res?.code === 0 ? res?.data?.user_bill_list : []
        setBills(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setBills([])
      })
      .finally(() => {
        if (!cancelled) setBillsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  const cancel = async (record: InvoiceRecord) => {
    try {
      await cancelInvoice(record.id)
      message.success('已撤销申请')
      void loadAll(page, status)
    } catch {
      message.error('撤销失败，请稍后再试')
    }
  }

  const summaryCards = [
    { label: '已开票', value: money(summary.issued_amount), hint: '电子发票会发到你填的邮箱' },
    { label: '审核中', value: money(summary.pending_amount), hint: '等站长处理，不用重复提交' },
    { label: '还能开', value: money(summary.invoiceable_amount), hint: `累计充值 ${money(summary.recharge_total)}` }
  ]

  const renderBillAction = (bill: InvoiceBill) => {
    const invoice = invoiceByBill.get(String(bill.bill_id))
    const status = invoice?.status
    if (status === 'rejected') {
      return (
        <span className={styles.billAction}>
          <Tag color={STATUS_META.rejected.color}>已驳回</Tag>
          {backendReady ? (
            <Button size="small" type="link" onClick={() => setInvoiceTarget(bill)}>
              重新申请
            </Button>
          ) : null}
        </span>
      )
    }
    if (status) {
      const meta = STATUS_META[status] || STATUS_META.pending
      return <Tag color={meta.color}>{meta.label}</Tag>
    }
    if (!backendReady) return <span className={styles.billMuted}>开票服务未开通</span>
    return (
      <Button size="small" type="primary" ghost onClick={() => setInvoiceTarget(bill)}>
        开发票
      </Button>
    )
  }

  return (
    <>
      <div className={styles.topGrid}>
        <section className={styles.summary}>
          {summaryCards.map((card) => (
            <div key={card.label} className={styles.summaryCard}>
              <span>{card.label}</span>
              <b className={styles.num}>{card.value}</b>
              <em>{card.hint}</em>
            </div>
          ))}
        </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <IconBadge icon={<FileTextOutlined />} tone="brand" size="sm" />
          <div>
            <h2>怎么开发票</h2>
            <p>不用单独填金额：在「充值记录」里选一笔已支付充值，金额和订单号自动带出来。</p>
          </div>
        </div>
        <ol className={styles.steps}>
          <li>
            <b>选一笔已支付充值</b>
            <span>在「充值记录」里核对金额和日期，点右侧「开发票」。</span>
          </li>
          <li>
            <b>点「开发票」填抬头</b>
            <span>企业填营业执照全称 + 税号；个人填姓名。电子发票发到邮箱。</span>
          </li>
          <li>
            <b>等站长审核</b>
            <span>1–3 个工作日开出，状态在这里实时可见；审核中可以撤销。</span>
          </li>
        </ol>
        <ul className={styles.ruleList}>
          <li>只对<b>已支付</b>的充值订单开票，余额消费不开票。</li>
          <li>一笔订单只能开一张发票，已开过的不能再开。</li>
          <li>本站只开电子普通发票，不办增值税专用发票。</li>
        </ul>
      </section>

      </div>

      <div className={styles.bottomGrid}>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <IconBadge icon={<HistoryOutlined />} tone="violet" size="sm" />
          <div>
            <h2>开票记录</h2>
            <p>待审核 / 开票中可以撤销。</p>
          </div>
          <div className={styles.headActions}>
            <Select
              value={status}
              style={{ width: 120 }}
              onChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'pending', label: '待审核' },
                { value: 'issuing', label: '开票中' },
                { value: 'issued', label: '已开票' },
                { value: 'rejected', label: '已驳回' }
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadAll(page, status)}>
              刷新
            </Button>
          </div>
        </div>

        <Spin spinning={loading}>
          {records.length === 0 ? (
            <Empty description={backendReady ? '还没有开票记录' : '开票记录：接口未开通'} />
          ) : (
            <div className={styles.records}>
              {records.map((record) => {
                const meta = STATUS_META[record.status] || STATUS_META.pending
                const billId = record.bill_id || record.order_no
                return (
                  <article key={record.id} className={styles.record}>
                    <div className={styles.recordTop}>
                      <strong>{money(record.amount)}</strong>
                      <Tag color={meta.color}>{meta.label}</Tag>
                      <span className={styles.recordTitle}>{record.title}</span>
                      <time>{record.created_at}</time>
                    </div>
                    <div className={styles.recordMeta}>
                      <span>电子普通发票</span>
                      {billId ? <span>订单号 {billId}</span> : null}
                      <span>{record.email}</span>
                      {record.tax_no ? <span>税号 {record.tax_no}</span> : null}
                      {record.invoice_no ? <span>发票号 {record.invoice_no}</span> : null}
                    </div>
                    {record.reject_reason ? <p className={styles.reject}>驳回原因：{record.reject_reason}</p> : null}
                    {record.status === 'pending' || record.status === 'issuing' ? (
                      <Button size="small" onClick={() => void cancel(record)}>
                        撤销申请
                      </Button>
                    ) : null}
                  </article>
                )
              })}
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
              onChange={(next) => void loadAll(next, status)}
            />
          </div>
        ) : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <IconBadge icon={<WalletOutlined />} tone="green" size="sm" />
          <div>
            <h2>充值记录</h2>
            <p>点右侧「开发票」，金额和订单号自动带进弹窗。</p>
          </div>
          <div className={styles.headActions}>
            <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey((n) => n + 1)} loading={billsLoading}>
              刷新
            </Button>
          </div>
        </div>

        <Spin spinning={billsLoading}>
          {bills.length === 0 ? (
            <Empty description="还没有充值记录（充值到账后会出现在这里）" />
          ) : (
            <div className={styles.billList}>
              {bills.map((bill) => (
                <article key={bill.bill_id} className={styles.billRow}>
                  <div className={styles.billMain}>
                    <strong className={styles.num}>{money(bill.pay)}</strong>
                    <div className={styles.billMeta}>
                      <time>{formatTime(bill.generate_time)}</time>
                      <span>订单号 {bill.bill_id}</span>
                      {bill.function_name ? <span>{bill.function_name}</span> : null}
                    </div>
                  </div>
                  {renderBillAction(bill)}
                </article>
              ))}
            </div>
          )}
        </Spin>
      </section>

      </div>

      <p className={styles.footerTip}>
        开票申请在本页「开票记录」里跟进状态，被驳回时会显示站长填写的理由，改完资料可重新提交。
        需要充值就切到上方「我的钱包」。
      </p>

      <InvoiceApplyModal
        open={Boolean(invoiceTarget)}
        bill={invoiceTarget}
        defaultEmail={userEmail}
        onClose={() => setInvoiceTarget(null)}
        onSubmitted={() => setRefreshKey((n) => n + 1)}
      />
    </>
  )
}

export default InvoicePanel
