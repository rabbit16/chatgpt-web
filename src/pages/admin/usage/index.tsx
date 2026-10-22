import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Collapse,
  DatePicker,
  Input,
  Select,
  Slider,
  Space,
  Table,
  Tag,
  message
} from 'antd'
import { CopyOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import {
  getRequestUsage,
  getUsageLatency,
  getUsageSummary,
  type UsageItem,
  type UsageLatency,
  type UsageQueryFilters,
  type UsageStatus,
  type UsageSummary
} from '@/request/api'
import { copyToClipboard } from '@/utils'
import styles from '../index.module.less'

const PAGE_SIZE = 50
const { RangePicker } = DatePicker

function contextTierTag(value?: string | null) {
  if (value === 'long') return <Tag color="orange">长上下文</Tag>
  if (value === 'short') return <Tag color="blue">短上下文</Tag>
  return '-'
}

const STATUS_META: Record<UsageStatus, { label: string; color: string }> = {
  pending: { label: '处理中', color: 'processing' },
  billed: { label: '已计费', color: 'success' },
  unbilled: { label: '未计费', color: 'default' },
  failed: { label: '失败', color: 'error' }
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  ...Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))
]

function formatMoney(value: number | null | undefined, highlight = false) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const text = `¥${Number(value).toFixed(6)}`
  if (!highlight) return text
  return <span style={{ color: '#067647', fontWeight: 600 }}>{text}</span>
}

function formatToken(value: number | null | undefined) {
  if (value == null) return '-'
  return Number(value).toLocaleString()
}

function formatSum(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `¥${Number(value).toFixed(4)}`
}

function formatRecharge(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  return `¥${Number(value).toFixed(2)}`
}

function formatTtfb(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '-'
  const ms = Number(value)
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function ttfbText(value: number | null | undefined, alertMs: number) {
  const text = formatTtfb(value)
  if (text === '-' || value == null || value <= alertMs) return text
  return <span style={{ color: '#b42318', fontWeight: 600 }}>{text}</span>
}

function rangeToApi(range: [Dayjs, Dayjs] | null): Pick<UsageQueryFilters, 'from' | 'to'> {
  if (!range?.[0] || !range?.[1]) return {}
  return {
    from: range[0].startOf('day').format('YYYY-MM-DDTHH:mm:ss'),
    to: range[1].add(1, 'day').startOf('day').format('YYYY-MM-DDTHH:mm:ss')
  }
}

function AdminUsage() {
  const [loading, setLoading] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [list, setList] = useState<UsageItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [latencyLoading, setLatencyLoading] = useState(false)
  const [latency, setLatency] = useState<UsageLatency | null>(null)
  const [error, setError] = useState('')
  const tableRef = useRef<HTMLDivElement>(null)
  const [scrollMax, setScrollMax] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const [userIdText, setUserIdText] = useState('')
  const [modelPrefix, setModelPrefix] = useState('')
  const [status, setStatus] = useState<UsageStatus | ''>('')
  const [requestId, setRequestId] = useState('')
  const [source, setSource] = useState('')
  const [path, setPath] = useState('')
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [applied, setApplied] = useState<UsageQueryFilters>({})

  const buildFilters = (): UsageQueryFilters | null => {
    const filters: UsageQueryFilters = { ...rangeToApi(range) }
    const uidRaw = userIdText.trim()
    if (uidRaw) {
      const uid = Number(uidRaw)
      if (!Number.isFinite(uid) || uid <= 0) {
        message.warning('请输入有效的用户 ID')
        return null
      }
      filters.userId = uid
    }
    const prefix = modelPrefix.trim()
    if (prefix) filters.modelPrefix = prefix
    if (status) filters.status = status
    const rid = requestId.trim()
    if (rid) filters.requestId = rid
    const src = source.trim()
    if (src) filters.source = src
    const p = path.trim()
    if (p) filters.path = p
    return filters
  }

  const loadSummary = async (filters: UsageQueryFilters) => {
    setSummaryLoading(true)
    try {
      const data = await getUsageSummary(filters)
      setSummary(data)
    } catch (err: any) {
      setSummary(null)
      if (String(err?.message || '').includes('404')) {
        message.warning('汇总接口暂未上线，卡片仅显示列表条数')
      } else {
        message.warning(err?.message || '用量汇总失败')
      }
    } finally {
      setSummaryLoading(false)
    }
  }

  const loadLatency = async (filters: UsageQueryFilters) => {
    setLatencyLoading(true)
    try {
      setLatency(await getUsageLatency(filters))
    } catch (err: any) {
      setLatency(null)
      if (String(err?.message || '').includes('404')) {
        message.warning('首字时延监控接口暂未上线，明细里仍会显示已有的首字时延')
      } else {
        message.warning(err?.message || '首字时延查询失败')
      }
    } finally {
      setLatencyLoading(false)
    }
  }

  const loadList = async (nextPage = 1, filters: UsageQueryFilters = applied) => {
    setLoading(true)
    setError('')
    try {
      const res = await getRequestUsage({
        ...filters,
        limit: PAGE_SIZE,
        offset: (nextPage - 1) * PAGE_SIZE
      })
      setList(res.items || [])
      setTotal(Number(res.total || 0))
      setPage(nextPage)
      setApplied(filters)
      void loadLatency(filters)
      if (nextPage === 1) void loadSummary(filters)
    } catch (err: any) {
      setList([])
      setTotal(0)
      setError(err?.message || '用量查询失败')
      message.error(err?.message || '用量查询失败')
    } finally {
      setLoading(false)
    }
  }

  const onSearch = () => {
    const filters = buildFilters()
    if (!filters) return
    void loadList(1, filters)
  }

  const onReset = () => {
    setUserIdText('')
    setModelPrefix('')
    setStatus('')
    setRequestId('')
    setSource('')
    setPath('')
    setRange(null)
    void loadList(1, {})
  }

  const tableScroller = () => {
    const root = tableRef.current
    if (!root) return null
    return (root.querySelector('.ant-table-body') || root.querySelector('.ant-table-content')) as HTMLElement | null
  }

  useEffect(() => {
    const el = tableScroller()
    if (!el) return
    const measure = () => {
      setScrollMax(Math.max(0, el.scrollWidth - el.clientWidth))
      setScrollLeft(el.scrollLeft)
    }
    measure()
    const onScroll = () => setScrollLeft(el.scrollLeft)
    el.addEventListener('scroll', onScroll)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [list, loading])

  useEffect(() => {
    void loadList(1, {})
  }, [])

  const alertMs = latency?.alert_ms ?? 15000
  const windowSize = latency?.window ?? 10
  const slowModels = (latency?.models || []).filter((item) => item.alert)
  const latencyHint = latency
    ? latency.lookback_days
      ? `未选时间时统计近 ${latency.lookback_days} 天。`
      : '按当前筛选的时间范围统计。'
    : '未选时间时统计近 7 天。'

  return (
    <div>
      {error ? (
        <Alert showIcon type="error" style={{ marginBottom: 16 }} message="查询失败" description={error} />
      ) : null}

      <div className={styles.cards}>
        <div className={styles.card}>
          <label>请求总数</label>
          <b>{summaryLoading && !summary ? '…' : summary?.request_count ?? total}</b>
        </div>
        <div className={styles.card}>
          <label>收费合计（已计费）</label>
          <b>{summaryLoading && !summary ? '…' : formatSum(summary?.sum_charged_cny)}</b>
        </div>
        <div className={styles.card}>
          <label>总充值</label>
          <b>
            {summaryLoading && !summary ? '…' : formatRecharge(summary?.sum_recharge_cny)}
          </b>
        </div>
        <div className={styles.card}>
          <label>成本合计（已计费）</label>
          <b>{summaryLoading && !summary ? '…' : formatSum(summary?.sum_cost_cny)}</b>
        </div>
        <div className={styles.card}>
          <label>利润合计（已计费）</label>
          <b>{summaryLoading && !summary ? '…' : formatSum(summary?.sum_profit_cny)}</b>
        </div>
      </div>

      {slowModels.length ? (
        <Alert
          showIcon
          type="error"
          style={{ marginBottom: 16 }}
          message="首字时延偏高"
          description={slowModels
            .map(
              (item) =>
                `${item.model}：最近 ${item.window_count} 次平均 ${formatTtfb(item.avg_ttfb_ms)}，超过 ${formatTtfb(alertMs)}`
            )
            .join('；')}
        />
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: '#344054', fontWeight: 600 }}>首字时延（分模型）</div>
        <div style={{ marginBottom: 8, color: '#667085', fontSize: 13 }}>
          {latencyHint}
          每个模型取最近 {windowSize} 次有首字时延的请求求平均，超过 {formatTtfb(alertMs)} 标红。不足 {windowSize}{' '}
          次只展示已有平均，不告警。
        </div>
        <Table
          rowKey="model"
          size="small"
          loading={latencyLoading}
          dataSource={latency?.models || []}
          pagination={false}
          locale={{ emptyText: latencyLoading ? '加载中…' : '这段时间还没有首字时延' }}
          columns={[
            { title: '模型', dataIndex: 'model', ellipsis: true },
            {
              title: '最近一次',
              dataIndex: 'latest_ttfb_ms',
              width: 120,
              render: (value: number | null) => ttfbText(value, alertMs)
            },
            {
              title: `最近 ${windowSize} 次平均`,
              dataIndex: 'avg_ttfb_ms',
              width: 150,
              render: (value: number | null) => ttfbText(value, alertMs)
            },
            {
              title: '窗口内最大',
              dataIndex: 'max_ttfb_ms',
              width: 120,
              render: (value: number | null) => ttfbText(value, alertMs)
            },
            {
              title: '样本',
              dataIndex: 'window_count',
              width: 90,
              render: (value: number) => `${value}/${windowSize}`
            },
            {
              title: '状态',
              dataIndex: 'alert',
              width: 110,
              render: (alert: boolean, record: { window_count: number }) => {
                if (alert) return <Tag color="error">偏慢</Tag>
                if (record.window_count < windowSize) return <Tag>样本不足</Tag>
                return <Tag color="success">正常</Tag>
              }
            }
          ]}
        />
      </div>

      <div className={styles.toolbar} style={{ flexWrap: 'wrap' }}>
        <Input
          allowClear
          placeholder="用户 ID"
          value={userIdText}
          onChange={(e) => setUserIdText(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 120 }}
        />
        <Input
          allowClear
          placeholder="模型前缀"
          value={modelPrefix}
          onChange={(e) => setModelPrefix(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 140 }}
        />
        <Select
          value={status}
          onChange={(value) => setStatus(value as UsageStatus | '')}
          options={STATUS_OPTIONS}
          style={{ width: 130 }}
        />
        <Input
          allowClear
          placeholder="request_id"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 140 }}
        />
        <Input
          allowClear
          placeholder="source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 120 }}
        />
        <Input
          allowClear
          placeholder="path，如 /v1/chat/completions"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onPressEnter={onSearch}
          style={{ width: 220 }}
        />
        <RangePicker
          value={range}
          onChange={(value) => setRange(value as [Dayjs, Dayjs] | null)}
          allowEmpty={[true, true]}
        />
        <Space>
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={onSearch}>
            查询
          </Button>
          <Button onClick={onReset}>重置</Button>
          <Button icon={<ReloadOutlined />} onClick={() => void loadList(page, applied)} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <div className={styles.scrollBar}>
        <span>左右滑动查看全部列</span>
        <div className={styles.scrollTrack}>
          <Slider
            min={0}
            max={Math.max(scrollMax, 1)}
            step={1}
            value={Math.min(scrollLeft, Math.max(scrollMax, 1))}
            disabled={scrollMax <= 0}
            tooltip={{ formatter: () => (scrollMax <= 0 ? '已显示全部列' : '拖动查看右侧列') }}
            onChange={(next) => {
              const el = tableScroller()
              if (el) el.scrollLeft = next
              setScrollLeft(next)
            }}
          />
        </div>
      </div>
      <div ref={tableRef}>
      <Table
        rowKey="request_id"
        loading={loading}
        dataSource={list}
        scroll={{ x: 1640 }}
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
            width: 150,
            ellipsis: true
          },
          {
            title: '首字时延',
            dataIndex: 'ttfb_ms',
            width: 110,
            render: (value: number | null) => ttfbText(value, alertMs)
          },
          {
            title: '路径',
            dataIndex: 'path',
            width: 180,
            ellipsis: true
          },
          {
            title: '来源',
            dataIndex: 'source',
            width: 100
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
            title: '收费',
            dataIndex: 'charged_cny',
            width: 120,
            render: (value: number | null, record: UsageItem) =>
              formatMoney(value, record.status === 'billed')
          },
          {
            title: '当前余额',
            dataIndex: 'balance_cny',
            width: 120,
            render: (value: number | null) => formatSum(value)
          },
          {
            title: '成本',
            dataIndex: 'cost_cny',
            width: 120,
            render: (value: number | null) => formatMoney(value)
          },
          {
            title: '利润',
            dataIndex: 'profit_cny',
            width: 120,
            render: (value: number | null, record: UsageItem) =>
              formatMoney(value, record.status === 'billed')
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
        ]}
      />
      </div>

      <Collapse
        style={{ marginTop: 20 }}
        items={[
          {
            key: 'guide',
            label: '使用方法 / 接口说明',
            children: (
              <div style={{ color: '#475467', lineHeight: 1.7 }}>
                <p>
                  列表：<code>GET /v1/usage</code>；汇总：<code>GET /v1/usage/summary</code>。筛选参数一致。
                </p>
                <p>
                  <b>筛选：</b>
                  user_id / model_prefix / status / source / request_id / from / to（to 为开区间）。
                </p>
                <p>
                  <b>汇总卡片：</b>
                  收费 / 成本 / 利润仅统计 <code>status=billed</code> 的金额合计，与当前筛选条件一致。总充值是成功支付订单合计，只跟随用户筛选。明细里的当前余额是该笔扣完后的账户余额。
                </p>
                <p>
                  <b>首字时延：</b>
                  流式请求记下第一段内容到达的耗时。<code>GET /v1/usage/latency</code> 按模型取最近 10
                  次平均，超过 15 秒标红。明细列来自 <code>ttfb_ms</code>。
                </p>
                <pre
                  style={{
                    margin: '12px 0 0',
                    padding: 12,
                    borderRadius: 8,
                    background: '#f8fafc',
                    overflow: 'auto'
                  }}
                >{`curl -sS 'https://your-api-domain.example.com/v1/usage?status=billed&limit=50&offset=0' \\
  -H 'Authorization: Bearer <ADMIN_API_KEY>'

curl -sS 'https://your-api-domain.example.com/v1/usage/summary?user_id=123&from=2026-09-01T00:00:00&to=2026-10-01T00:00:00' \\
  -H 'Authorization: Bearer <ADMIN_API_KEY>'`}</pre>
              </div>
            )
          }
        ]}
      />
    </div>
  )
}

export default AdminUsage
