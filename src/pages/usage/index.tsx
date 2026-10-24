import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Input, Select, Space, Table, Tag, message } from 'antd'
import { CopyOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
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
import Sparkline from './Sparkline'
import { formatCny } from '@/utils/money'
import styles from './index.module.less'

const PAGE_SIZE = 20
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

function formatToken(value: number | null | undefined) {
  if (value == null) return '-'
  return Number(value).toLocaleString()
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

/**
 * 生成趋势图要查的 14 个自然日（按**本地时区**，不是 UTC）
 * ------------------------------------------------------------
 * 旧代码用 toISOString() 拼桶键，东八区每天 00:00–08:00 的数据会被算到前一天，
 * 表现为「当天明明用了，图上却没涨」。这里统一用本地年月日，前后端口径一致。
 */
function buildTrendDays(days = 14) {
  const list: { key: string; label: string; from: string; to: string }[] = []
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())}`
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1, 0, 0, 0)
    const key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`
    list.push({ key, label: key.slice(5), from: fmt(start), to: fmt(end) })
  }
  return list
}

export function UsagePanel() {
  const { token, user_info, setLoginModal } = userStore()
  const userId = Number(user_info?.data?.bodyMessage?.userId)
  const hasUserId = Number.isFinite(userId) && userId > 0
  // 窄屏：表格列宽与横向总宽收窄，避免 390 下只露「时间」一列
  const narrow = useNarrow()

  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [list, setList] = useState<UsageItem[]>([])
  // 趋势图数据：
  // trendPoints  = 按天汇总好的点（首选，14 天走得全）
  // trendItems   = 汇总接口不可用时的降级来源（最近 200 条原始记录，只够画个大概）
  // trendDegraded= 降级后被截断，图上必须明说"仅覆盖最近 N 条"，不能假装是全量
  const [trendPoints, setTrendPoints] = useState<{ day: string; tokens: number }[] | null>(null)
  const [trendItems, setTrendItems] = useState<UsageItem[]>([])
  const [trendDegraded, setTrendDegraded] = useState(false)
  const [trendRefreshKey, setTrendRefreshKey] = useState(0)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [error, setError] = useState('')

  const [modelPrefix, setModelPrefix] = useState('')
  const [status, setStatus] = useState<UsageStatus | ''>('')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [applied, setApplied] = useState<UsageQueryFilters>({})

  const pageCharged = useMemo(() => sumBilledCharged(list), [list])

  // 趋势图：按天向 /usage/summary 取 14 天，而不是「最近 200 条」。
  //
  // 旧写法 getRequestUsage({ limit: 200 }) 有两个问题（站长 2026-10-24 反馈「近 14 天只统计到 1 天」）：
  //   1) 200 条是大促/客户端轮询模型列表时的几小时量，14 天窗口里 13 天永远取不到数据；
  //   2) 它混进 billed/unbilled/failed，趋势图把未计费请求也算进消耗。
  // 现在按「本地自然日」逐天查汇总（status=billed），天数固定 14，请求数固定 14 次，与总量无关。
  useEffect(() => {
    if (!token || !hasUserId) return
    let alive = true
    void (async () => {
      const days = buildTrendDays()
      try {
        const summaries = await Promise.all(
          days.map((day) =>
            getUsageSummary({
              userId,
              status: 'billed',
              from: day.from,
              to: day.to
            })
              .then((res) => ({
                day: day.key,
                tokens: Number(res?.sum_input_tokens || 0) + Number(res?.sum_output_tokens || 0)
              }))
              .catch(() => ({ day: day.key, tokens: 0 }))
          )
        )
        if (alive) {
          setTrendPoints(summaries)
          setTrendDegraded(false)
        }
      } catch {
        // 汇总接口整组失败（老后端 404）：退回一次列表查询，并标记为「近似」
        try {
          const data = await getRequestUsage({ userId, status: 'billed', limit: 200, offset: 0 })
          if (alive) {
            setTrendItems(data.items)
            setTrendPoints(null)
            setTrendDegraded(Number(data.total || 0) > 200)
          }
        } catch {
          /* 趋势图失败不影响主表格 */
        }
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasUserId, trendRefreshKey])

  const buildFilters = (): UsageQueryFilters => {
    const filters: UsageQueryFilters = { userId, ...rangeToApi(range) }
    const prefix = modelPrefix.trim()
    if (prefix) filters.modelPrefix = prefix
    if (status) filters.status = status
    return filters
  }

  const loadSummary = async (filters: UsageQueryFilters) => {
    setSummaryLoading(true)
    try {
      const data = await getUsageSummary(filters)
      setSummary(data)
    } catch (err: any) {
      setSummary(null)
      // summary 未就绪时不阻断列表
      if (String(err?.message || '').includes('404')) {
        message.warning('汇总接口暂未上线，仅展示列表与本页扣费')
      } else {
        message.warning(err?.message || '用量汇总失败')
      }
    } finally {
      setSummaryLoading(false)
    }
  }

  const loadList = async (nextPage = 1, filters = applied) => {
    if (!token) {
      setError('请先登录后查看自己的使用记录')
      return
    }
    if (!hasUserId) {
      setError('登录资料缺少用户 ID，无法查询使用记录')
      return
    }

    setLoading(true)
    setError('')
    try {
      const query = { ...filters, userId }
      const res = await getRequestUsage({
        ...query,
        limit: PAGE_SIZE,
        offset: (nextPage - 1) * PAGE_SIZE
      })
      setList(res.items || [])
      setTotal(Number(res.total || 0))
      setPage(nextPage)
      setApplied(query)
      if (nextPage === 1) void loadSummary(query)
    } catch (err: any) {
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
      setLoading(false)
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
  }, [token, hasUserId, userId])

  const charged = summary?.sum_charged_cny
  const requestCount = summary?.request_count ?? total

  return (
    <div className={styles.wrapPanel}>
          <header className={styles.pageHead}>
            <p className={styles.pageHeadNote}>
              每次请求的 token、缓存、耗时、扣费与扣后余额，都能在这张表里查到。
            </p>
            {token ? (
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  void loadList(page, applied)
                  // 趋势图数据源与表格不同（按天查汇总），刷新时一起重新取
                  setTrendRefreshKey((n) => n + 1)
                }}
                loading={loading || summaryLoading}
              >
                刷新
              </Button>
            ) : (
              <Button type="primary" onClick={() => setLoginModal(true)}>
                登录查看
              </Button>
            )}
          </header>

          {!token ? (
            <Alert
              showIcon
              type="info"
              message="需要登录"
              description="登录后可查看本账号的请求用量明细，不会看到其他用户的数据。"
            />
          ) : null}

          {error ? <Alert showIcon type={token ? 'warning' : 'info'} message={error} /> : null}

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

              <Sparkline
                points={trendPoints}
                items={trendPoints ? undefined : trendItems.length ? trendItems : list}
                degraded={trendDegraded}
              />

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

              <section className={styles.card}>
                <HorizontalDrag watch={`${list.length}:${loading}:${page}`}>
                <Table
                  rowKey="request_id"
                  loading={loading}
                  dataSource={list}
                  scroll={{ x: narrow ? 980 : 1800 }}
                  locale={{ emptyText: loading ? '加载中…' : '暂无使用记录' }}
                  pagination={{
                    current: page,
                    total,
                    pageSize: PAGE_SIZE,
                    showSizeChanger: false,
                    showTotal: (value) => `共 ${value} 条`,
                    onChange: (next) => void loadList(next, applied)
                  }}
                  columns={[
                    {
                      title: '时间',
                      dataIndex: 'created_at',
                      width: narrow ? 132 : 170,
                      onCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
                      render: (value: string | null) => value || '-'
                    },
                    {
                      title: '用户 ID',
                      dataIndex: 'user_id',
                      width: 90,
                      render: (value: number | null) => (value == null ? '-' : value)
                    },
                    {
                      title: '模型',
                      dataIndex: 'model',
                      width: 160,
                      ellipsis: true
                    },
                    {
                      title: '首字时延',
                      dataIndex: 'ttfb_ms',
                      width: 110,
                      render: (value: number | null) => ttfbText(value)
                    },
                    {
                      title: '路径',
                      dataIndex: 'path',
                      width: 180,
                      ellipsis: true
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      width: 100,
                      render: (value: UsageStatus) => {
                        const meta = STATUS_META[value] || { label: value, color: 'default' }
                        return <Tag color={meta.color}>{meta.label}</Tag>
                      }
                    },
                    {
                      title: '计费档',
                      dataIndex: 'context_tier',
                      width: 110,
                      render: (value: UsageItem['context_tier']) => contextTierTag(value)
                    },
                    {
                      title: 'HTTP',
                      dataIndex: 'http_status',
                      width: 80,
                      render: (value: number | null) => value ?? '-'
                    },
                    {
                      title: '输入',
                      dataIndex: 'input_tokens',
                      width: 80,
                      render: formatToken
                    },
                    {
                      title: '输出',
                      dataIndex: 'output_tokens',
                      width: 80,
                      render: formatToken
                    },
                    {
                      title: '缓存读',
                      dataIndex: 'cache_read_tokens',
                      width: 80,
                      render: formatToken
                    },
                    {
                      title: '缓存写',
                      dataIndex: 'cache_write_tokens',
                      width: 80,
                      render: formatToken
                    },
                    {
                      title: '扣费',
                      dataIndex: 'charged_cny',
                      width: 120,
                      render: (value: number | null, record: UsageItem) =>
                        formatMoney(value, record.status === 'billed')
                    },
                    {
                      title: '当前余额',
                      dataIndex: 'balance_cny',
                      width: 120,
                      render: (value: number | null) => formatBalance(value)
                    },
                    {
                      title: '请求 ID',
                      dataIndex: 'request_id',
                      width: 160,
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
                  ]}
                />
                </HorizontalDrag>
              </section>

              <Alert
                showIcon
                type="info"
                message="说明"
                description="筛选和总消费由服务端完成。列表展示每次请求的模型、路径、状态、计费档、HTTP、输入、输出、缓存读、缓存写、首字时延、扣费、当前余额和请求 ID。总充值是这个账号全部成功支付的合计，不随模型和时间筛选变化。已计费请求的「当前余额」是这笔扣完后账户还剩多少。首字时延超过 15 秒标红。金额单位为人民币元。"
              />
            </>
          ) : null}
    </div>
  )
}

