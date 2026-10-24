import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, Empty, Pagination, Select, Spin, Tag, message } from 'antd'
import {
  FileTextOutlined,
  HistoryOutlined,
  MergeCellsOutlined,
  ReloadOutlined,
  WalletOutlined
} from '@ant-design/icons'
import IconBadge from '@/components/IconBadge'
import InvoiceApplyModal, { type InvoiceBill, type InvoiceSubmittedInfo } from '@/components/InvoiceApplyModal'
import { userBillList } from '@/request/api'
import { formatCny, sumCny } from '@/utils/money'
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
 * 开票中心（2026-10-24 起独立成栏目 /invoice）
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

/**
 * 一次最多合并多少笔（站长建议值 20）
 * 防两类问题：①误操作一次并进几十笔，开错票很难撤回；
 * ②后端合并接口一次性处理太多订单压力大。
 */
const MERGE_MAX = 20

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

  /**
   * 合并开票（2026-10-24 站长需求）
   * ------------------------------------------------------------
   * selectMode=false 时界面和以前一模一样：没有勾选框，只有每行右侧的「开发票」。
   * 站长强调单笔开票是高频动作，不能因为新功能把常用路径弄复杂，
   * 所以勾选框只在用户主动点了「合并开票」后才出现。
   *
   * selectedIds 用 Set 而不是数组：勾选/取消是高频操作，
   * Set.has 是 O(1)，20 笔也感觉不到卡顿。
   */
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  /** 合并弹窗要开的那些订单（null = 弹窗关闭） */
  const [mergeBills, setMergeBills] = useState<InvoiceBill[] | null>(null)

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

  /* ---------------- 合并开票：能不能勾、勾了多少钱 ---------------- */

  /**
   * 一笔充值能不能参与合并？
   * 规则（站长确认）：
   *   - 没有任何开票记录 → 可以
   *   - 已驳回 rejected → 可以（平台允许重新申请，合并里也一样）
   *   - 待审核 pending / 开票中 issuing / 已开票 issued → 不行
   *     （已经开过或正在开的订单再并进新票里，会开出重复发票）
   * 开票服务没开通时整个入口都不显示，所以这里不用管 backendReady。
   */
  const canMergeBill = useCallback(
    (bill: InvoiceBill) => {
      const invoice = invoiceByBill.get(String(bill.bill_id))
      return !invoice || invoice.status === 'rejected'
    },
    [invoiceByBill]
  )

  /** 可参与合并的总笔数：为 0 时「合并开票」按钮没必要显示 */
  const mergeableCount = useMemo(() => bills.filter((bill) => canMergeBill(bill)).length, [bills, canMergeBill])

  /** 已选中的订单对象（按 bills 顺序，保证明细顺序和列表一致） */
  const selectedBills = useMemo(
    () => bills.filter((bill) => selectedIds.includes(String(bill.bill_id))),
    [bills, selectedIds]
  )

  /** 合计金额：按分求和，避免浮点误差（详见 utils/money.ts 的 sumCny） */
  const selectedTotal = useMemo(() => sumCny(selectedBills.map((bill) => bill.pay)), [selectedBills])

  const exitSelectMode = useCallback(() => {
    setSelectMode(false)
    setSelectedIds([])
  }, [])

  /**
   * 勾选 / 取消勾选
   * 上限 20 笔：一是后端合并接口压力，二是弹窗明细超过 20 条就没人核对了，
   * 反而更容易开错票。到上限时给提示并拒绝继续勾，而不是静默忽略。
   */
  const toggleBill = useCallback(
    (bill: InvoiceBill, checked: boolean) => {
      const id = String(bill.bill_id)
      setSelectedIds((prev) => {
        if (!checked) return prev.filter((item) => item !== id)
        if (prev.includes(id)) return prev
        if (prev.length >= MERGE_MAX) {
          message.warning(`一次最多合并 ${MERGE_MAX} 笔，请先取消几笔再选`)
          return prev
        }
        return [...prev, id]
      })
    },
    []
  )

  const openMergeModal = () => {
    if (!selectedBills.length) return
    setMergeBills(selectedBills)
  }

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

  // 开票服务不通时不允许停留在选择态：否则用户勾了半天下拉才发现没有提交入口。
  useEffect(() => {
    if (!backendReady) {
      setSelectMode(false)
      setSelectedIds([])
    }
  }, [backendReady])

  /**
   * 勾选后如果订单状态变了（比如刚提交成功、或别处又开了一张），
   * 要把已经"不可合并"的订单从选中列表里剔除，
   * 否则会出现"明明显示已开票却还在合计里"的错账。
   * 只在确实有变化时才 setState，避免无限渲染。
   */
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => {
        const bill = bills.find((item) => String(item.bill_id) === id)
        return Boolean(bill) && canMergeBill(bill!)
      })
      return next.length === prev.length ? prev : next
    })
  }, [bills, canMergeBill])

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
    // 副标题原来是「累计充值 ¥370.00」，主数字也是 ¥370.00，同一张卡同一个数字出现两次；
    // 改成说明这个数字是什么（可开票上限），避免看起来像重复渲染。
    { label: '还能开', value: money(summary.invoiceable_amount), hint: '本页可开票金额上限' }
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
      {/* 页头（2026-10-24 视觉验收 P2）：
          这一页原来完全没有 h1，点进来没有任何文字确认「我在开票中心」，
          首屏 39% 是两个 ¥0.00 的大卡。现在补页标题 + 一句规则说明。 */}
      <header className={styles.pageHead}>
        <div>
          <h1>开票中心</h1>
          <p>电子发票由站长人工审核，1–3 个工作日发到你填的邮箱；一笔订单只能开一张。</p>
        </div>
      </header>

      <div className={styles.summaryRow}>
        {summaryCards.map((card) => {
          // 零值降级：¥0.00 用 26px/700 占着页面最大权重，用户会以为「没充上」
          const isEmpty = card.value === '¥0.00' || card.value === '¥0'
          return (
            <div
              key={card.label}
              className={styles.summaryCard}
              data-empty={isEmpty || undefined}
              data-primary={card.label === '还能开' ? true : undefined}
            >
              <span>{card.label}</span>
              {isEmpty ? <b className={styles.summaryEmpty}>暂无</b> : <b className={styles.num}>{card.value}</b>}
              {isEmpty ? null : <em>{card.hint}</em>}
            </div>
          )
        })}
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
            <p>
              {selectMode
                ? `勾选要合并的充值（最多 ${MERGE_MAX} 笔），金额自动相加。已开票/审核中的不能选。`
                : '点右侧「开发票」，金额和订单号自动带进弹窗。'}
            </p>
          </div>
          <div className={styles.headActions}>
            {/* 合并入口只在「有可合并的订单」且「后端已通」时显示：
                没有可合并的订单却给按钮，点进去全是禁用的，纯属添乱。 */}
            {!selectMode && backendReady && mergeableCount > 0 ? (
              <Button icon={<MergeCellsOutlined />} onClick={() => setSelectMode(true)}>
                合并开票
              </Button>
            ) : null}
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
              {bills.map((bill) => {
                const canMerge = canMergeBill(bill)
                const checked = selectedIds.includes(String(bill.bill_id))
                return (
                  <article
                    key={bill.bill_id}
                    className={styles.billRow}
                    // 选中行高亮描边：勾选后一眼能看出"这几笔要被合并"
                    data-select={selectMode ? true : undefined}
                    data-checked={selectMode && checked ? true : undefined}
                    data-disabled={selectMode && !canMerge ? true : undefined}
                    // 选择态下整行可点（手机上 20px 的勾选框太难戳），
                    // 不可参与的行不响应点击，避免误以为能选
                    onClick={selectMode && canMerge ? () => toggleBill(bill, !checked) : undefined}
                  >
                    {selectMode ? (
                      <Checkbox
                        checked={checked}
                        disabled={!canMerge}
                        // 行本身已经绑了 onClick，这里必须阻止冒泡，否则会触发两次
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => toggleBill(bill, event.target.checked)}
                        aria-label={`选择订单 ${bill.bill_id}`}
                      />
                    ) : null}
                    <div className={styles.billMain}>
                      <strong className={styles.num}>{formatCny(bill.pay)}</strong>
                      <div className={styles.billMeta}>
                        <time>{formatTime(bill.generate_time)}</time>
                        <span>订单号 {bill.bill_id}</span>
                        {bill.function_name ? <span>{bill.function_name}</span> : null}
                      </div>
                    </div>
                    {/* 选择态下右侧不再放「开发票」按钮：一次只能做一件事，
                        既避免误点单笔开票，也让勾选界面更干净。
                        不可合并的行只给一句短提示：写长了在手机上会把金额挤掉。 */}
                    {selectMode ? (
                      !canMerge ? <span className={styles.billMuted}>已开票</span> : null
                    ) : (
                      renderBillAction(bill)
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </Spin>

        {/* 选择态操作条：已选笔数 + 合计 + 提交/取消。
            放在列表下方，视线自然落点，也符合"选完就提交"的顺序。 */}
        {selectMode ? (
          <div className={styles.mergeBar}>
            <div className={styles.mergeSummary}>
              <span className={styles.mergeCount}>
                已选 <b>{selectedBills.length}</b> 笔
              </span>
              <span className={styles.mergeDivider} aria-hidden="true">
                ·
              </span>
              <span className={styles.mergeTotal}>
                合计 <b>{formatCny(selectedTotal)}</b>
              </span>
              {selectedBills.length >= MERGE_MAX ? (
                <span className={styles.mergeLimit}>已达上限 {MERGE_MAX} 笔</span>
              ) : null}
            </div>
            <div className={styles.mergeActions}>
              <Button onClick={exitSelectMode}>取消</Button>
              {/* 一笔都没选时禁用：合并开票至少需要 2 笔才有意义 */}
              <Button
                type="primary"
                icon={<MergeCellsOutlined />}
                disabled={selectedBills.length < 2}
                onClick={openMergeModal}
              >
                合并开票
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      </div>

      <p className={styles.footerTip}>
        开票申请在本页「开票记录」里跟进状态，被驳回时会显示站长填写的理由，改完资料可重新提交。
        需要充值就切到上方「我的钱包」。
      </p>

      {/* 单笔开票弹窗：行为与改动前完全一致（不传 bills） */}
      <InvoiceApplyModal
        open={Boolean(invoiceTarget)}
        bill={invoiceTarget}
        defaultEmail={userEmail}
        onClose={() => setInvoiceTarget(null)}
        onSubmitted={() => setRefreshKey((n) => n + 1)}
      />

      {/* 合并开票弹窗：传 bills，弹窗显示合计和逐笔明细 */}
      <InvoiceApplyModal
        open={Boolean(mergeBills)}
        bill={null}
        bills={mergeBills}
        defaultEmail={userEmail}
        onClose={() => setMergeBills(null)}
        onSubmitted={(info?: InvoiceSubmittedInfo) => {
          setRefreshKey((n) => n + 1)
          // 只有后端确认成功才退出选择态；业务失败时保留勾选，
          // 用户改完抬头可以直接重试，不用从头再勾一遍。
          if (info?.success) {
            setSelectMode(false)
            setSelectedIds([])
          }
        }}
      />

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
    </>
  )
}

export default InvoicePanel
