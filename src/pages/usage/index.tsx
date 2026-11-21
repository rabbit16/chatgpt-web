import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Checkbox, DatePicker, Empty, Input, InputNumber, Pagination, Popover, Select, Space, Spin, Table, Tag, message } from 'antd'
import { CopyOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import HorizontalDrag from '@/components/HorizontalDrag'
import { useNarrow } from '@/hooks/useNarrow'
import {
  getRequestUsage,
  getUsageSummary,
  type UsageItem,
  type UsageQueryFilters,
  type UsageStatus,
  type UsageSummary
} from '@/request/api'
import { userStore } from '@/store'
import { copyToClipboard } from '@/utils'
import { formatCny } from '@/utils/money'
import styles from './index.module.less'

type UsageColumn = {
  title: string
  dataIndex?: keyof UsageItem
  width: number
  ellipsis?: boolean
  onCell?: () => { style: { whiteSpace: 'nowrap' } }
  render?: (value: any, row: UsageItem) => ReactNode
}

const PRIMARY_FIELDS = ['created_at', 'model', 'result', 'charged_cny', 'balance_cny']
const PAGE_SIZES = [10, 20, 50]
const MAX_PAGE_SIZE = 200
const { RangePicker } = DatePicker

const STATUS_META: Record<UsageStatus, { label: string; color: string }> = {
  pending: { label: '处理中', color: 'processing' },
  billed: { label: '已计费', color: 'success' },
  unbilled: { label: '未计费', color: 'default' },
  failed: { label: '失败', color: 'error' }
}

function contextTierTag(value?: string | null) {
  if (value === 'long') return <Tag color="orange">长上下文</Tag>
  if (value === 'short') return <Tag color="blue">短上下文</Tag>
  return '-'
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))
]

function formatMoney(value: number | null | undefined, highlight = false) {
  // 统一走 utils/money：≥1 元两位小数 + 千分位，小额四位去尾零。
  // 原来一律 toFixed(6)，同一笔钱在不同页面会显示成 ¥542.187200 与 ¥542.19（视觉验收 P3）。
  const text = formatCny(value)
  if (!highlight) return text
  return <span className={styles.money}>{text}</span>
}

function formatBalance(value: number | null | undefined) {
  // 统一金额规约（验收阻塞项 3）：≥1 元两位 + 千分位，小额四位去尾零
  if (value == null || Number.isNaN(Number(value))) return '-'
  return <span className={styles.balance}>{formatCny(value)}</span>
}

function formatRecharge(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return formatCny(value)
}

const TTFB_ALERT_MS = 15000

function formatTtfb(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const ms = Number(value)
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function ttfbText(value: number | null | undefined) {
  const text = formatTtfb(value)
  if (text === '-' || value == null || value <= TTFB_ALERT_MS) return text
  return <span className={styles.slow}>{text}</span>
}

function sumBilledCharged(items: UsageItem[]) {
  return items.reduce((acc, item) => {
    if (item.status !== 'billed' || item.charged_cny == null) return acc
    return acc + Number(item.charged_cny)
  }, 0)
}

/** RangePicker 闭区间日期 → API from(含) / to(不含) */
function rangeToApi(range: [Dayjs, Dayjs] | null): Pick<UsageQueryFilters, 'from' | 'to'> {
  if (!range?.[0] || !range?.[1]) return {}
  return {
    from: range[0].startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
    to: range[1].add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
  }
}

export function UsagePanel() {
  const { token, user_info, setLoginModal } = userStore()
  const userId = Number(user_info?.data?.bodyMessage?.userId)
  const hasUserId = Number.isFinite(userId) && userId > 0
  const narrow = useNarrow()

  const [visibleFields, setVisibleFields] = useState<string[]>(PRIMARY_FIELDS)
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [list, setList] = useState<UsageItem[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [customSizeOpen, setCustomSizeOpen] = useState(false)
  const [customPageSize, setCustomPageSize] = useState<number | null>(10)
  const listRequest = useRef(0)
  const summaryRequest = useRef(0)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [error, setError] = useState('')

  const [modelPrefix, setModelPrefix] = useState('')
  const [status, setStatus] = useState<UsageStatus | ''>('')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [applied, setApplied] = useState<UsageQueryFilters>({})

  const pageCharged = useMemo(() => sumBilledCharged(list), [list])

  const buildFilters = (): UsageQueryFilters => {
    const filters: UsageQueryFilters = { userId, ...rangeToApi(range) }
    const prefix = modelPrefix.trim()
    if (prefix) filters.modelPrefix = prefix
    if (status) filters.status = status
    return filters
  }

  const loadSummary = async (filters: UsageQueryFilters) => {
    const requestId = ++summaryRequest.current
    setSummaryLoading(true)
    try {
      const data = await getUsageSummary(filters)
      if (requestId !== summaryRequest.current) return
      setSummary(data)
    } catch (err: any) {
      if (requestId !== summaryRequest.current) return
      setSummary(null)
      // summary 未就绪时不阻断列表
      if (String(err?.message || '').includes('404')) {
        message.warning('汇总接口暂未上线，仅展示列表与本页扣费')
      } else {
        message.warning(err?.message || '用量汇总失败')
      }
    } finally {
      if (requestId === summaryRequest.current) setSummaryLoading(false)
    }
  }

  const loadList = async (nextPage = 1, filters = applied, nextPageSize = pageSize) => {
    if (!token) {
      setError('请先登录后查看自己的使用记录')
      return
    }
    if (!hasUserId) {
      setError('登录资料缺少用户 ID，无法查询使用记录')
      return
    }

    const requestId = ++listRequest.current
    setLoading(true)
    setError('')
    try {
      const query = { ...filters, userId }
      const res = await getRequestUsage({
        ...query,
        limit: nextPageSize,
        offset: (nextPage - 1) * nextPageSize
      })
      if (requestId !== listRequest.current) return
      setList(res.items || [])
      setTotal(Number(res.total || 0))
      setPage(nextPage)
      setPageSize(nextPageSize)
      setApplied(query)
      if (nextPage === 1) void loadSummary(query)
    } catch (err: any) {
      if (requestId !== listRequest.current) return
      setList([])
      setTotal(0)
      const msg = String(err?.message || '')
      if (msg.includes('403')) {
        setError('当前账号暂无权限查询用量，请确认后端已开放「用户查自己」接口。')
      } else {
        setError(msg || '使用记录查询失败')
      }
      message.error('使用记录查询失败')
    } finally {
      if (requestId === listRequest.current) setLoading(false)
    }
  }

  const onSearch = () => {
    const filters = buildFilters()
    void loadList(1, filters)
  }

  const onReset = () => {
    setModelPrefix('')
    setStatus('')
    setRange(null)
    const filters: UsageQueryFilters = { userId }
    void loadList(1, filters)
  }

  useEffect(() => {
    if (token && hasUserId) {
      setSummary(null)
      void loadList(1, { userId })
    } else {
      setList([])
      setTotal(0)
      setSummary(null)
      setError(token ? '登录资料缺少用户 ID，无法查询使用记录' : '请先登录后查看自己的使用记录')
    }
    return () => {
      listRequest.current += 1
      summaryRequest.current += 1
    }
  }, [token, hasUserId, userId])

  const charged = summary?.sum_charged_cny
  const requestCount = summary?.request_count ?? total

  const columns: UsageColumn[] = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      onCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
      render: (value: string | null) => value || '-'
    },
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      width: 76,
      render: (value: number | null) => (value == null ? '-' : value)
    },
    {
      title: '模型',
      dataIndex: 'model',
      width: 140,
      ellipsis: true
    },
    {
      title: '首字时延',
      dataIndex: 'ttfb_ms',
      width: 96,
      render: (value: number | null) => ttfbText(value)
    },
    {
      title: '路径',
      dataIndex: 'path',
      width: 130,
      ellipsis: true
    },
    {
      title: '计费状态',
      dataIndex: 'status',
      width: 96,
      render: (value: UsageStatus, row: UsageItem) => {
        if (value === 'failed') {
          const charged = row.charged_cny
          return charged == null ? <Tag>计费未确认</Tag> : charged > 0 ? <Tag color="success">已计费</Tag> : <Tag>未计费</Tag>
        }
        const meta = STATUS_META[value] || { label: value, color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      }
    },
    {
      title: '请求结果',
      width: 88,
      render: (_: unknown, row: UsageItem) => {
        if (row.status === 'failed' || (row.http_status != null && row.http_status >= 400)) return <Tag color="error">失败</Tag>
        if (row.status === 'pending') return <Tag color="processing">处理中</Tag>
        if (row.http_status != null && row.http_status >= 200 && row.http_status < 300) return <Tag color="success">成功</Tag>
        return <Tag>未确认</Tag>
      }
    },
    {
      title: '计费档',
      dataIndex: 'context_tier',
      width: 88,
      render: (value: UsageItem['context_tier']) => contextTierTag(value)
    },
    {
      title: 'HTTP',
      dataIndex: 'http_status',
      width: 64,
      render: (value: number | null) => value ?? '-'
    },
    {
      title: '扣费',
      dataIndex: 'charged_cny',
      width: 100,
      render: (value: number | null, record: UsageItem) =>
        formatMoney(value, record.status === 'billed')
    },
    {
      title: '当前余额',
      dataIndex: 'balance_cny',
      width: 100,
      render: (value: number | null) => formatBalance(value)
    },
    {
      title: '请求 ID',
      dataIndex: 'request_id',
      width: 130,
      render: (value: string) => (
        <Button
          type="link"
          size="small"
          icon={<CopyOutlined />}
          onClick={async () => {
            try {
              await copyToClipboard(value)
              message.success('已复制请求 ID')
            } catch {
              message.error('复制失败')
            }
          }}
        >
          {value}
        </Button>
      )
    }
  ]
  const visibleColumns = columns.filter((column) => visibleFields.includes(column.dataIndex || 'result'))
  const hasExtraFields = visibleFields.some((field) => !PRIMARY_FIELDS.includes(field))
  const isDefaultFields = visibleFields.length === PRIMARY_FIELDS.length && PRIMARY_FIELDS.every((field) => visibleFields.includes(field))
  const emptyText = applied.modelPrefix || applied.status || applied.from || applied.to
    ? '没有符合筛选条件的记录'
    : '暂无使用记录'
  const pagination = {
    current: page,
    total,
    pageSize,
    showSizeChanger: false,
    showTotal: (value: number) => `共 ${value} 条`,
    onChange: (next: number) => void loadList(next, applied)
  }

  return (
    <div className={styles.wrapPanel}>
          {!token ? <Button type="primary" onClick={() => setLoginModal(true)}>登录查看</Button> : null}

          {!token ? (
            <Alert
              showIcon
              type="info"
              message="需要登录"
              description="登录后可查看本账号的请求用量明细，不会看到其他用户的数据。"
            />
          ) : null}

          {error ? <Alert showIcon type={token ? 'warning' : 'info'} message={error} action={token && <Button size="small" onClick={() => void loadList(page, applied)}>重试</Button>} /> : null}

          {token ? (
            <>
              <div className={styles.filters}>
                <Input
                  allowClear
                  placeholder="模型前缀，如 gpt-6"
                  value={modelPrefix}
                  onChange={(e) => setModelPrefix(e.target.value)}
                  onPressEnter={onSearch}
                  style={{ width: 180 }}
                />
                <Select
                  value={status}
                  onChange={(value) => setStatus(value as UsageStatus | '')}
                  options={STATUS_OPTIONS}
                  style={{ width: 140 }}
                />
                <RangePicker
                  value={range}
                  onChange={(value) => setRange(value as [Dayjs, Dayjs] | null)}
                  allowEmpty={[true, true]}
                />
                <Space>
                  <Button type="primary" icon={<SearchOutlined />} onClick={onSearch} loading={loading}>
                    查询
                  </Button>
                  <Button onClick={onReset}>重置</Button>
                </Space>
              </div>

              {/* 2026-11-20 站长：四个统计块太占首屏，收成一条横幅，明细表一眼可见 */}
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <label>请求总数</label>
                  <b>{summaryLoading && !summary ? '…' : requestCount}</b>
                </div>
                <div className={styles.stat}>
                  <label>总充值</label>
                  <b>
                    {summaryLoading && summary?.sum_recharge_cny == null
                      ? '…'
                      : formatRecharge(summary?.sum_recharge_cny)}
                  </b>
                </div>
                <div className={`${styles.stat} ${styles.statPrimary}`}>
                  <label>总消费（已计费）</label>
                  <b>
                    {summaryLoading && charged == null
                      ? '…'
                      : charged == null
                        ? '-'
                        : formatCny(charged)}
                  </b>
                </div>
                <div className={styles.stat}>
                  <label>本页扣费（已计费）</label>
                  <b>{formatCny(pageCharged)}</b>
                </div>
              </div>

              <section className={styles.card} aria-label="请求使用记录">
                <div className={styles.recordsHead}>
                  <h2>请求明细</h2>
                  <div className={styles.recordActions}>
                  <Select
                    aria-label="每页显示条数"
                    value={customSizeOpen || !PAGE_SIZES.includes(pageSize) ? 'custom' : pageSize}
                    disabled={loading}
                    style={{ width: 126 }}
                    options={[
                      ...PAGE_SIZES.map((size) => ({ value: size, label: `每页 ${size} 条` })),
                      { value: 'custom', label: PAGE_SIZES.includes(pageSize) ? '自定义条数' : `每页 ${pageSize} 条` }
                    ]}
                    onChange={(value) => {
                      if (value === 'custom') {
                        setCustomPageSize(pageSize)
                        setCustomSizeOpen(true)
                      } else {
                        setCustomSizeOpen(false)
                        void loadList(1, applied, Number(value))
                      }
                    }}
                  />
                  <Popover
                    trigger="click"
                    placement="bottomRight"
                    title={<span id="usage-page-size-hint">自定义每页条数（1–{MAX_PAGE_SIZE}）</span>}
                    open={customSizeOpen}
                    onOpenChange={setCustomSizeOpen}
                    content={
                      <Space>
                        <InputNumber
                          aria-label="自定义每页条数"
                          aria-describedby="usage-page-size-hint"
                          min={1}
                          max={MAX_PAGE_SIZE}
                          precision={0}
                          value={customPageSize}
                          onChange={setCustomPageSize}
                        />
                        <Button
                          type="primary"
                          disabled={!customPageSize || !Number.isSafeInteger(customPageSize) || customPageSize < 1 || customPageSize > MAX_PAGE_SIZE}
                          onClick={() => {
                            if (!customPageSize || !Number.isSafeInteger(customPageSize) || customPageSize < 1 || customPageSize > MAX_PAGE_SIZE) return
                            setCustomSizeOpen(false)
                            void loadList(1, applied, customPageSize)
                          }}
                        >应用</Button>
                      </Space>
                    }
                  >
                    {!PAGE_SIZES.includes(pageSize) ? <Button disabled={loading}>修改条数</Button> : <span />}
                  </Popover>
                  <Button icon={<ReloadOutlined />} loading={loading || summaryLoading} onClick={() => void loadList(page, applied)}>刷新</Button>
                  <Popover
                    trigger="click"
                    placement="bottomRight"
                    title="显示字段"
                    content={
                      <div className={styles.fieldPicker}>
                        <p>勾选要显示的字段，按原表格顺序排列。</p>
                        {columns.map((column) => {
                          const field = column.dataIndex || 'result'
                          return (
                            <Checkbox
                              key={field}
                              checked={visibleFields.includes(field)}
                              onChange={(event) => setVisibleFields((fields) => event.target.checked
                                ? [...fields, field]
                                : fields.filter((value) => value !== field))}
                            >
                              {column.title}
                            </Checkbox>
                          )
                        })}
                        <Button size="small" disabled={isDefaultFields} onClick={() => setVisibleFields(PRIMARY_FIELDS)}>恢复默认</Button>
                      </div>
                    }
                  >
                    <Button icon={<SettingOutlined />}>显示字段 · {visibleFields.length}</Button>
                  </Popover>
                  </div>
                </div>
                {!visibleColumns.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择要显示的字段" />
                ) : narrow ? (
                  <Spin spinning={loading}>
                    <div className={styles.mobileRecords}>
                      {list.length ? list.map((row) => (
                        <article className={styles.record} key={row.request_id}>
                          <dl>
                            {visibleColumns.map((column) => {
                              const field = column.dataIndex || 'result'
                              const value = column.dataIndex ? row[column.dataIndex] : undefined
                              return (
                                <div key={field} className={field === 'created_at' || field === 'model' || !PRIMARY_FIELDS.includes(field) ? styles.fullField : styles.compactField}>
                                  <dt>{column.title}</dt>
                                  <dd>{column.render ? column.render(value, row) : value ?? '-'}</dd>
                                </div>
                              )
                            })}
                          </dl>
                        </article>
                      )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}
                    </div>
                    <Pagination {...pagination} simple className={styles.mobilePagination} />
                  </Spin>
                ) : (
                  <HorizontalDrag watch={`${list.length}:${loading}:${page}:${visibleFields.join(',')}`}>
                    <Table
                      rowKey="request_id"
                      loading={loading}
                      dataSource={list}
                      scroll={hasExtraFields ? { x: visibleColumns.reduce((width, column) => width + column.width, 0) } : undefined}
                      locale={{ emptyText: loading ? '加载中…' : emptyText }}
                      pagination={pagination}
                      columns={visibleColumns.map((column) => ({ ...column, key: column.dataIndex || 'result' }))}
                    />
                  </HorizontalDrag>
                )}
              </section>

              <Alert
                showIcon
                type="info"
                message="说明"
                description="筛选和总消费由服务端完成。默认展示时间、模型、请求结果、扣费和当前余额，其他信息可在「显示字段」中勾选。总充值是这个账号全部成功支付的合计，不随模型和时间筛选变化。已计费请求的「当前余额」是这笔扣完后账户还剩多少。首字时延超过 15 秒标红。金额单位为人民币元。"
              />
            </>
          ) : null}
    </div>
  )
}

