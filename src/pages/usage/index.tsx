import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Input, Select, Space, Table, Tag, message } from 'antd'
import { CopyOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import HorizontalDrag from '@/components/HorizontalDrag'
import Layout from '@/components/Layout'
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
  if (value == null || Number.isNaN(Number(value))) return '-'
  const text = `¥${Number(value).toFixed(6)}`
  if (!highlight) return text
  return <span className={styles.money}>{text}</span>
}

function formatToken(value: number | null | undefined) {
  if (value == null) return '-'
  return Number(value).toLocaleString()
}

function formatBalance(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return <span className={styles.balance}>¥{Number(value).toFixed(4)}</span>
}

function formatRecharge(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `¥${Number(value).toFixed(2)}`
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

function UsagePage() {
  const { token, user_info, setLoginModal } = userStore()
  const userId = Number(user_info?.data?.bodyMessage?.userId)
  const hasUserId = Number.isFinite(userId) && userId > 0

  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [list, setList] = useState<UsageItem[]>([])
  const [page, setPage] = useState(1)
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
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.pageHead}>
            <div>
              <h1>使用记录</h1>
              <p>查看你账号下每次模型请求的 token、缓存、耗时、扣费和扣完后的余额</p>
            </div>
            {token ? (
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void loadList(page, applied)}
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
                        : `¥${Number(charged).toFixed(4)}`}
                  </b>
                </div>
                <div className={styles.stat}>
                  <label>本页扣费（已计费）</label>
                  <b>¥{pageCharged.toFixed(4)}</b>
                </div>
              </div>

              <section className={styles.card}>
                <HorizontalDrag watch={`${list.length}:${loading}:${page}`}>
                <Table
                  rowKey="request_id"
                  loading={loading}
                  dataSource={list}
                  scroll={{ x: 1800 }}
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
                      width: 170,
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
      </Layout>
    </div>
  )
}

export default UsagePage
