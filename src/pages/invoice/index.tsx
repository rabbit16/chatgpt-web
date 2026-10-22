import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Pagination, Select, Spin, Tag, message } from 'antd'
import {
  ArrowRightOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ReconciliationOutlined,
  ReloadOutlined,
  WalletOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
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
 * 我的发票（用户端）
 * ------------------------------------------------------------
 * 站长要求：发票必须对应「某一笔已支付的充值」，不能在任意页面随手开。
 * 所以这里只展示记录，不再提供自由填金额的表单；
 * 申请入口统一在「价格与充值 → 余额与充值 → 支付记录」里，一单一票。
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

function InvoicePage() {
  const [summary, setSummary] = useState<InvoiceSummary>(EMPTY_SUMMARY)
  const [records, setRecords] = useState<InvoiceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [backendReady, setBackendReady] = useState(true)

  const loadAll = useCallback(
    async (nextPage = 1, nextStatus: InvoiceStatus | 'all' = status) => {
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
    },
    [status]
  )

  useEffect(() => {
    void loadAll(1, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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
    {
      label: '已开票',
      value: money(summary.issued_amount),
      hint: '电子发票会发到你填的邮箱'
    },
    {
      label: '审核中',
      value: money(summary.pending_amount),
      hint: '等站长处理，不用重复提交'
    },
    {
      label: '还能开',
      value: money(summary.invoiceable_amount),
      hint: `累计充值 ${money(summary.recharge_total)}`
    }
  ]

  const handleTab = (next: InvoiceStatus | 'all') => {
    setStatus(next)
    setPage(1)
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <ReconciliationOutlined /> 财务管理
            </p>
            <h1>我的发票</h1>
            <p className={styles.lead}>
              发票按<b>充值订单</b>开：到「价格与充值 → 余额与充值 → 支付记录」里，对某一笔已支付充值点「开发票」。
              一单一票，已开票的订单不能重复申请。
            </p>
            <div className={styles.headActions}>
              <Link to="/price?tab=shop">
                <Button type="primary" icon={<WalletOutlined />}>
                  去支付记录开发票
                </Button>
              </Link>
            </div>
          </header>

          <section className={styles.summary}>
            {summaryCards.map((card) => (
              <div key={card.label} className={styles.summaryCard}>
                <span>{card.label}</span>
                <b className={styles.num}>{card.value}</b>
                <em>{card.hint}</em>
              </div>
            ))}
          </section>

          <div className={styles.cardGrid}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <IconBadge icon={<FileTextOutlined />} tone="brand" size="sm" />
                <div>
                  <h2>怎么开发票</h2>
                  <p>不用单独填金额，选哪笔充值就开哪笔，金额自动带出来。</p>
                </div>
              </div>
              <ol className={styles.steps}>
                <li>
                  <b>打开支付记录</b>
                  <span>价格与充值 → 余额与充值 → 往下找到「支付记录」。</span>
                </li>
                <li>
                  <b>找到要开票的那笔充值</b>
                  <span>点右侧「开发票」，填抬头、税号和邮箱。</span>
                </li>
                <li>
                  <b>等站长审核</b>
                  <span>1–3 个工作日开出，电子发票发到邮箱；审核中可撤销。</span>
                </li>
              </ol>
              <Link to="/price?tab=shop">
                <Button icon={<ArrowRightOutlined />}>去支付记录</Button>
              </Link>
            </section>

            <aside className={styles.side}>
              <section className={styles.sideCard}>
                <h2>开票规则</h2>
                <ul>
                  <li>只对<b>已支付</b>的充值订单开票，余额消费不开票。</li>
                  <li>一笔订单只能开一张发票，已开过的不能再开。</li>
                  <li>抬头、税号按营业执照填；个人抬头填姓名即可。</li>
                  <li>本站只开电子普通发票，不办增值税专用发票。</li>
                </ul>
              </section>

              <section className={styles.sideCard}>
                <h2>记录在哪</h2>
                <p>提交后在本页下方「开票记录」里看状态；审核中还能撤销，已开票不能改。</p>
              </section>
            </aside>
          </div>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <IconBadge icon={<HistoryOutlined />} tone="violet" size="sm" />
              <div>
                <h2>开票记录</h2>
                <p>最新的在最上面；状态为「待审核 / 开票中」时可以撤销。</p>
              </div>
              <div className={styles.headActions}>
                <Select
                  value={status}
                  style={{ width: 120 }}
                  onChange={(value) => handleTab(value)}
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
                        {record.reject_reason ? (
                          <p className={styles.reject}>驳回原因：{record.reject_reason}</p>
                        ) : null}
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

          <p className={styles.footerTip}>
            发票问题也可以在「公告留言」里给站长留言，附上订单号和邮箱，处理更快。
          </p>
        </div>
      </Layout>
    </div>
  )
}

export default InvoicePage
