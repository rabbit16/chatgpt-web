import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Empty, Form, Input, InputNumber, Pagination, Radio, Select, Spin, Tag, message } from 'antd'
import { FileTextOutlined, HistoryOutlined, ReconciliationOutlined, ReloadOutlined } from '@ant-design/icons'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import {
  cancelInvoice,
  createInvoice,
  getInvoiceList,
  getInvoiceSummary,
  type InvoiceRecord,
  type InvoiceStatus,
  type InvoiceSummary
} from '@/request/invoice'
import styles from './index.module.less'

/**
 * 开发票（用户端）
 * ------------------------------------------------------------
 * 为什么放在这里：开票只和「充值」有关，所以入口放在「价格与充值」页和
 * 顶栏用户菜单里；页面本身独立 /invoice，方便收藏、也方便后台对账。
 *
 * 交互顺序刻意和现实一致：先看到「还能开多少」，再填抬头，最后查记录。
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
  const [form] = Form.useForm()
  const [summary, setSummary] = useState<InvoiceSummary>(EMPTY_SUMMARY)
  const [records, setRecords] = useState<InvoiceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [backendReady, setBackendReady] = useState(true)
  const [titleType, setTitleType] = useState<'company' | 'personal'>('company')
  const [kind, setKind] = useState<'electronic' | 'special'>('electronic')

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

  const maxAmount = Number(summary.invoiceable_amount || 0)

  const submit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const res: any = await createInvoice({
        amount: Number(values.amount),
        kind: values.kind,
        title_type: values.title_type,
        title: String(values.title || '').trim(),
        tax_no: values.title_type === 'company' ? String(values.tax_no || '').trim() : undefined,
        email: String(values.email || '').trim(),
        order_no: values.order_no ? String(values.order_no).trim() : undefined,
        remark: values.remark ? String(values.remark).trim() : undefined
      })
      if (res && res.code !== undefined && String(res.code) !== '0') {
        message.error(res.codeMsg || '提交失败，请稍后再试')
        return
      }
      message.success('已提交，审核通过后会把电子发票发到邮箱')
      form.resetFields(['amount', 'order_no', 'remark'])
      void loadAll(1, status)
    } catch (error: any) {
      if (error?.errorFields) return
      message.error('提交失败：开票接口暂时不可用，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async (record: InvoiceRecord) => {
    try {
      await cancelInvoice(record.id)
      message.success('已撤销申请')
      void loadAll(page, status)
    } catch {
      message.error('撤销失败，请稍后再试')
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: '还能开票', value: money(summary.invoiceable_amount), hint: `累计充值 ${money(summary.recharge_total)}` },
      { label: '审核中', value: money(summary.pending_amount), hint: '等站长处理，不用重复提交' },
      { label: '已开票', value: money(summary.issued_amount), hint: '电子发票会发到你的邮箱' }
    ],
    [summary]
  )

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
            <h1>开发票</h1>
            <p className={styles.lead}>
              只对<b>已支付的充值订单</b>开票。填好抬头和邮箱提交，站长审核后开票（一般 1–3 个工作日），电子发票直接发邮箱。
            </p>
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
                  <h2>申请开票</h2>
                  <p>一次申请一张发票；抬头信息按营业执照原样填，开错要作废重开。</p>
                </div>
              </div>

              <Form form={form} layout="vertical" requiredMark="optional" initialValues={{ kind: 'electronic', title_type: 'company' }}>
                <Form.Item
                  name="amount"
                  label="开票金额"
                  extra={maxAmount > 0 ? `最多可开 ${money(maxAmount)}` : '暂无可开票金额，先完成一次充值'}
                  rules={[
                    { required: true, message: '请填写开票金额' },
                    {
                      validator: (_, value) => {
                        const amount = Number(value || 0)
                        if (amount <= 0) return Promise.reject(new Error('金额要大于 0'))
                        if (maxAmount > 0 && amount > maxAmount + 0.001) {
                          return Promise.reject(new Error('不能超过可开票金额'))
                        }
                        return Promise.resolve()
                      }
                    }
                  ]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={maxAmount || undefined}
                    precision={2}
                    addonBefore="¥"
                    placeholder="例如 100.00"
                  />
                </Form.Item>

                <Form.Item name="kind" label="发票类型" rules={[{ required: true }]}>
                  <Radio.Group
                    className={styles.radioRow}
                    onChange={(event) => setKind(event.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="electronic">电子普通发票</Radio.Button>
                    <Radio.Button value="special">增值税专用发票</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                <Form.Item name="title_type" label="抬头类型" rules={[{ required: true }]}>
                  <Radio.Group
                    className={styles.radioRow}
                    onChange={(event) => setTitleType(event.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="company">企业</Radio.Button>
                    <Radio.Button value="personal">个人</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                <Form.Item
                  name="title"
                  label={titleType === 'company' ? '公司名称' : '个人姓名'}
                  rules={[{ required: true, message: '请填写发票抬头' }]}
                >
                  <Input maxLength={60} placeholder={titleType === 'company' ? '营业执照上的全称' : '与身份证一致'} />
                </Form.Item>

                {titleType === 'company' ? (
                  <Form.Item
                    name="tax_no"
                    label="纳税人识别号"
                    rules={[{ required: true, message: '企业抬头必须填税号' }]}
                  >
                    <Input maxLength={30} placeholder="15 / 18 / 20 位，字母数字" />
                  </Form.Item>
                ) : null}

                <Form.Item
                  name="email"
                  label="接收邮箱"
                  rules={[
                    { required: true, message: '请填写接收电子发票的邮箱' },
                    { type: 'email', message: '邮箱格式不对' }
                  ]}
                >
                  <Input maxLength={80} placeholder="发票 PDF 会发到这里" />
                </Form.Item>

                <Form.Item name="order_no" label="充值订单号">
                  <Input maxLength={60} placeholder="在「价格与充值 → 余额与充值」里能查到" />
                </Form.Item>

                {kind === 'special' ? (
                  <Alert
                    className={styles.tip}
                    type="info"
                    showIcon
                    message="专用发票需要补资料"
                    description="提交后站长会联系你补充开户行、账号、地址和电话；资料齐全才会开专票。"
                  />
                ) : null}

                <Form.Item name="remark" label="备注">
                  <Input.TextArea maxLength={200} rows={2} placeholder="比如：请合并开一张" />
                </Form.Item>

                <Button
                  type="primary"
                  size="large"
                  block
                  loading={submitting}
                  disabled={!backendReady}
                  onClick={() => void submit()}
                >
                  提交申请
                </Button>
                {!backendReady ? (
                  <p className={styles.backendHint}>
                    开票服务还没开通（等站长配置后端接口）；页面可以先看着。
                  </p>
                ) : null}
              </Form>
            </section>

            <aside className={styles.side}>
              <section className={styles.sideCard}>
                <h2>开票说明</h2>
                <ul>
                  <li>只对<b>已支付</b>的充值订单开票，余额消费不开票。</li>
                  <li>抬头、税号按营业执照填；个人抬头填姓名即可。</li>
                  <li>审核通过后 1–3 个工作日开出，电子发票发到你填的邮箱。</li>
                  <li>需要专票的，提交后补齐开户行、账号、地址、电话。</li>
                  <li>开错了要作废重开，所以提交前多看一眼税号。</li>
                </ul>
              </section>

              <section className={styles.sideCard}>
                <h2>记录在哪</h2>
                <p>提交后在本页下方「开票记录」里能看状态；审核中还能撤销，已开票就不能改了。</p>
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
                    return (
                      <article key={record.id} className={styles.record}>
                        <div className={styles.recordTop}>
                          <strong>{money(record.amount)}</strong>
                          <Tag color={meta.color}>{meta.label}</Tag>
                          <span className={styles.recordTitle}>{record.title}</span>
                          <time>{record.created_at}</time>
                        </div>
                        <div className={styles.recordMeta}>
                          <span>{record.kind === 'special' ? '增值税专用发票' : '电子普通发票'}</span>
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
            发票问题也可以在「公告留言」里给站长留言，附上邮箱和金额，处理更快。
          </p>
        </div>
      </Layout>
    </div>
  )
}

export default InvoicePage
