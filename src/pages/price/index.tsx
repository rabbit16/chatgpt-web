import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, InputNumber, Select, Table, Tag } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { ReloadOutlined } from '@ant-design/icons'
import HorizontalDrag from '@/components/HorizontalDrag'
import Layout from '@/components/Layout'
import PillTabs from '@/components/PillTabs'
import ShopPanel from '@/pages/shop'
import { getUserPricing, type UserModelRate, type UserPricing } from '@/request/api'
import { userStore } from '@/store'
import {
  PUBLIC_IMAGE_MODELS,
  PUBLIC_MODEL_IDS,
  PUBLIC_MODELS,
  PUBLIC_PRICING_NOTE,
  PUBLIC_PRICING_UPDATED_AT
} from '@/data/publicPricing'
import type { UserPricing as PublicPricingShape } from '@/request/api'
import {
  PROVIDER_META,
  compareModelNewestFirst,
  enrichVendorModel,
  formatUsd,
  getImageModelIntro,
  isPerImageBilling,
  pickFeaturedModelIds,
  type ModelProvider
} from '@/data/modelPricing'
import styles from './index.module.less'

type TabKey = 'all' | ModelProvider

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  ...Object.entries(PROVIDER_META).map(([key, meta]) => ({ key: key as ModelProvider, label: meta.label }))
]

/**
 * 未登录时的公开参考价。
 * 接口 /v1/pricing/models 需要密钥（匿名 401），所以用离线抓取的标准价快照，
 * 保证访客在没注册时也能看到"有哪些模型、大概多少钱"。
 */
const PUBLIC_PRICING: PublicPricingShape = {
  currency: 'USD',
  price_unit: 'per 1M tokens',
  usd_cny_rate: 0,
  profit_multiplier: 0,
  money_rate: 0,
  discount: 1,
  vendor: undefined,
  model_ids: PUBLIC_MODEL_IDS,
  models: PUBLIC_MODELS,
  image_models: PUBLIC_IMAGE_MODELS
}

function formatPrice(amount: number) {
  if (amount === 0) return '$0'
  return formatUsd(amount) === '$0.00' ? `$${amount.toExponential(2)}` : formatUsd(amount)
}

function standardRate(rates: UserModelRate[]) {
  return rates.find((item) => item.service_tier === 'standard') || rates[0]
}

function promptUsesLongContext(rate: UserModelRate | undefined, promptTokens: number) {
  const long = rate?.long_context
  if (!long) return false
  return long.op === 'ge' ? promptTokens >= long.threshold : promptTokens > long.threshold
}

function longContextGate(rate: UserModelRate['long_context']) {
  if (!rate) return ''
  const kilo = Math.round(rate.threshold / 1000)
  return rate.op === 'ge' ? `达到 ${kilo}K` : `超过 ${kilo}K`
}

function PricePage() {
  // 价格与充值合并在同一页：?tab=shop 看余额与套餐
  const [searchParams, setSearchParams] = useSearchParams()
  const viewTab = searchParams.get('tab') === 'shop' ? 'shop' : 'price'
  const switchTab = (next: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'shop') nextParams.set('tab', 'shop')
    else nextParams.delete('tab')
    setSearchParams(nextParams, { replace: true })
  }
  const { token, user_info, setLoginModal, llm_api_key } = userStore()
  const info = user_info as { data?: { bodyMessage?: { telephone?: string } }; telephone?: string } | undefined
  const phone = info?.data?.bodyMessage?.telephone || info?.telephone
  const credential =
    (llm_api_key || '').startsWith('sk-') || /^1[3-9]\d{9}$/.test(llm_api_key || '')
      ? llm_api_key
      : phone || ''
  const requestRef = useRef(0)
  const [pricing, setPricing] = useState<UserPricing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [modelId, setModelId] = useState('')
  const [tier, setTier] = useState('standard')
  const [inputTokens, setInputTokens] = useState(8000)
  const [cachedHitTokens, setCachedHitTokens] = useState(0)
  const [cacheWriteTokens, setCacheWriteTokens] = useState(0)
  const [outputTokens, setOutputTokens] = useState(2000)

  const loadPricing = async (signal?: AbortSignal) => {
    const request = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const data = await getUserPricing({ signal })
      if (!Array.isArray(data.models)) throw new Error('价目数据不完整，请稍后重试')
      if (request === requestRef.current && !signal?.aborted) setPricing(data)
    } catch (err) {
      if (request === requestRef.current && !signal?.aborted) {
        setPricing(null)
        setError(err instanceof Error ? err.message : '获取模型价目失败')
      }
    } finally {
      if (request === requestRef.current && !signal?.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    setPricing(null)
    setError('')
    if (token && credential) {
      void loadPricing(controller.signal)
    } else if (!token) {
      // 未登录：用公开参考价，页面不再是空白 + 一句"登录后可见"
      setPricing(PUBLIC_PRICING)
    }
    return () => {
      controller.abort()
      requestRef.current++
    }
  }, [token, credential])

  // 完全按供应商返回的模型展示；元数据只补简介/推荐标记，绝不过滤
  const models = useMemo(() => {
    const grouped = new Map<string, UserModelRate[]>()
    for (const item of pricing?.models || []) {
      if (!item?.model) continue
      if (!grouped.has(item.model)) grouped.set(item.model, [])
      grouped.get(item.model)!.push(item)
    }

    // model_ids 若存在，用于保持供应商侧顺序兜底；最终仍按「新→旧」排序
    const idOrder = pricing?.model_ids?.length
      ? pricing.model_ids.filter((id) => grouped.has(id))
      : [...grouped.keys()]
    for (const id of grouped.keys()) {
      if (!idOrder.includes(id)) idOrder.push(id)
    }

    const featured = new Set(pickFeaturedModelIds(idOrder, 6))

    return idOrder
      .map((id) => {
        const rates = grouped.get(id)!
        const enriched = enrichVendorModel({
          id,
          name: rates[0]?.display_name,
          owned_by: rates[0]?.owned_by
        })
        return {
          id,
          name: enriched.name,
          provider: enriched.provider,
          rates,
          intro: enriched.intro,
          recommend: featured.has(id) || enriched.recommendPref
        }
      })
      .sort((a, b) => compareModelNewestFirst(a.id, b.id))
  }, [pricing])

  const imageModels = useMemo(() => {
    return [...(pricing?.image_models || [])]
      .map((item) => {
        const enriched = enrichVendorModel({
          id: item.model,
          name: item.display_name,
          owned_by: item.owned_by
        })
        return {
          ...item,
          name: enriched.name,
          provider: enriched.provider,
          intro: getImageModelIntro(item.model)
        }
      })
      .sort((a, b) => compareModelNewestFirst(a.model, b.model))
  }, [pricing])

  const list = useMemo(
    () => (tab === 'all' ? models : models.filter((item) => item.provider === tab)),
    [models, tab]
  )
  const currentModel = models.find((item) => item.id === modelId) || models[0]
  const selectedRate =
    currentModel?.rates.find((item) => item.service_tier === tier) ||
    currentModel?.rates.find((item) => item.service_tier === 'standard') ||
    currentModel?.rates[0]

  const unit = (value: number) => formatPrice(value)
  const estimate = (value: number, tokens: number) => (value * tokens) / 1_000_000
  const promptTokens = inputTokens + cachedHitTokens + cacheWriteTokens
  const useLong = promptUsesLongContext(selectedRate, promptTokens)
  const billedRate =
    useLong && selectedRate?.long_context
      ? {
          ...selectedRate,
          input: selectedRate.long_context.input,
          output: selectedRate.long_context.output,
          cache_read: selectedRate.long_context.cache_read,
          cache_write: selectedRate.long_context.cache_write
        }
      : selectedRate
  const input = billedRate ? estimate(billedRate.input, inputTokens) : 0
  const hit = billedRate ? estimate(billedRate.cache_read, cachedHitTokens) : 0
  const write = billedRate ? estimate(billedRate.cache_write, cacheWriteTokens) : 0
  const output = billedRate ? estimate(billedRate.output, outputTokens) : 0

  const columns = [
    {
      title: '模型',
      dataIndex: 'name',
      width: 280,
      fixed: 'left' as const,
      render: (_: string, record: (typeof models)[number]) => (
        <div>
          <div className={styles.modelCellName}>
            <Tag color={PROVIDER_META[record.provider].color}>{PROVIDER_META[record.provider].label}</Tag>
            {record.name}
            {record.recommend ? <Tag color="blue">推荐</Tag> : null}
          </div>
          <div className={styles.modelCellId}>{record.id}</div>
          <div className={styles.modelIntro}>{record.intro}</div>
        </div>
      )
    },
    {
      title: '模式',
      dataIndex: 'rates',
      width: 120,
      render: (rates: UserModelRate[]) => rates.map((item) => item.service_tier).join(' / ')
    },
    {
      title: '输入',
      dataIndex: 'rates',
      width: 120,
      render: (rates: UserModelRate[]) => (
        <span className={styles.usdOnly}>{unit(standardRate(rates).input)}</span>
      )
    },
    {
      title: '缓存读取',
      dataIndex: 'rates',
      width: 130,
      render: (rates: UserModelRate[]) => (
        <span className={styles.usdOnly}>
          {unit(standardRate(rates).cache_read)}
        </span>
      )
    },
    {
      title: '缓存写入',
      dataIndex: 'rates',
      width: 130,
      render: (rates: UserModelRate[]) => (
        <span className={styles.usdOnly}>
          {unit(standardRate(rates).cache_write)}
        </span>
      )
    },
    {
      title: '输出',
      dataIndex: 'rates',
      width: 120,
      render: (rates: UserModelRate[]) => (
        <span className={styles.usdOnly}>
          {unit(standardRate(rates).output)}
        </span>
      )
    },
    {
      title: '长上下文',
      dataIndex: 'rates',
      width: 180,
      render: (rates: UserModelRate[]) => {
        const long = standardRate(rates).long_context
        if (!long) return <span className={styles.usdOnly}>—</span>
        return (
          <div className={styles.longCell}>
            <span>{longContextGate(long)}</span>
            <span>输入 {unit(long.input)}</span>
            <span>缓存读取 {unit(long.cache_read)}</span>
            <span>缓存写入 {unit(long.cache_write)}</span>
            <span>输出 {unit(long.output)}</span>
          </div>
        )
      }
    }
  ]

  return (
    <div className={styles.pricePage}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.pageHead}>
            <div>
              <h1>{viewTab === 'shop' ? '余额与充值' : '模型价格'}</h1>
              <p>
                {viewTab === 'shop'
                  ? '查看当前余额、选择充值套餐，历史订单在下方列表里'
                  : '按当前供应商实际可用模型展示 · 美元（USD）/ 百万 tokens · 最新优先'}
              </p>
            </div>
            {viewTab === 'price' && token && (
              <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadPricing()}>
                刷新价格
              </Button>
            )}
          </header>

          <PillTabs
            ariaLabel="价格与充值"
            value={viewTab}
            onChange={switchTab}
            items={[
              { key: 'price', label: '模型价格' },
              { key: 'shop', label: '余额与充值' }
            ]}
          />

          {viewTab === 'shop' ? (
            token ? (
              <ShopPanel />
            ) : (
              <div className={styles.publicNote}>
                <span className={styles.publicNoteText}>登录后可以查看余额、选择套餐充值</span>
                <Button type="primary" onClick={() => setLoginModal(true)}>
                  登录 / 注册
                </Button>
              </div>
            )
          ) : (
            <>

          {!token ? (
            <div className={styles.publicNote}>
              <span className={styles.publicNoteText}>
                {PUBLIC_PRICING_NOTE} · 更新于 {PUBLIC_PRICING_UPDATED_AT}
              </span>
              <Button type="primary" onClick={() => setLoginModal(true)}>
                登录 / 注册
              </Button>
            </div>
          ) : !credential ? (
            <Alert showIcon type="warning" message="请先到「Agent 接入」页创建 sk- 密钥，再查看个人费率" />
          ) : loading && !pricing ? (
            <Alert showIcon type="info" message="正在获取当前账号价格…" />
          ) : error ? (
            <Alert showIcon type="error" message={error} action={<Button onClick={() => void loadPricing()}>重试</Button>} />
          ) : null}

          {pricing && (
            <>
              <section className={styles.calculator}>
                <h2>费用估算</h2>
                <p>
                  按当前个人美元单价估算。有长短上下文差价的模型，会按非缓存输入、缓存读取、缓存写入的合计自动切换单价。
                </p>
                {currentModel?.intro ? <p className={styles.modelPickHint}>当前选型：{currentModel.intro}</p> : null}
                <div className={styles.calcRow}>
                  <div className={styles.field}>
                    <label>模型</label>
                    <Select
                      showSearch
                      optionFilterProp="label"
                      value={currentModel?.id}
                      onChange={(value) => {
                        setModelId(value)
                        setTier('standard')
                      }}
                      options={models.map((item) => ({
                        value: item.id,
                        label: `${PROVIDER_META[item.provider].label} · ${item.name}`
                      }))}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>处理模式</label>
                    <Select
                      value={selectedRate?.service_tier}
                      onChange={setTier}
                      options={currentModel?.rates.map((item) => ({ value: item.service_tier, label: item.service_tier })) || []}
                    />
                  </div>
                  <div className={styles.field}>
                    <label>非缓存输入 tokens</label>
                    <InputNumber min={0} value={inputTokens} onChange={(value) => setInputTokens(Number(value || 0))} />
                  </div>
                  <div className={styles.field}>
                    <label>缓存读取 tokens</label>
                    <InputNumber min={0} value={cachedHitTokens} onChange={(value) => setCachedHitTokens(Number(value || 0))} />
                  </div>
                  <div className={styles.field}>
                    <label>缓存写入 tokens</label>
                    <InputNumber min={0} value={cacheWriteTokens} onChange={(value) => setCacheWriteTokens(Number(value || 0))} />
                  </div>
                  <div className={styles.field}>
                    <label>输出 tokens</label>
                    <InputNumber min={0} value={outputTokens} onChange={(value) => setOutputTokens(Number(value || 0))} />
                  </div>
                </div>
                <div className={styles.calcFooter}>
                  {selectedRate?.long_context ? (
                    <Tag color={useLong ? 'orange' : 'blue'}>{useLong ? '长上下文' : '短上下文'}</Tag>
                  ) : null}
                  <div className={styles.calcBreakdown}>
                    <span>输入 {formatPrice(input)}</span>
                    <span>缓存读取 {formatPrice(hit)}</span>
                    <span>缓存写入 {formatPrice(write)}</span>
                    <span>输出 {formatPrice(output)}</span>
                  </div>
                  <div className={styles.calcResult}>
                    <span>预计消费（USD）</span>
                    <strong>{formatPrice(input + hit + write + output)}</strong>
                  </div>
                </div>
              </section>

              <section className={styles.tableCard}>
                <div className={styles.tableHead}>
                  <h2>
                    完整价目 <small>当前可用模型 · 最新在前</small>
                  </h2>
                  <div className={styles.tabs}>
                    {tabs.map(({ key, label }) => (
                      <button key={key} className={tab === key ? styles.tabActive : undefined} onClick={() => setTab(key)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <HorizontalDrag watch={list.length + tab}>
                <Table
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  columns={columns}
                  dataSource={list}
                  scroll={{ x: 1180 }}
                  expandable={{
                    rowExpandable: (record) => record.rates.length > 1,
                    expandedRowRender: (record) => (
                      <div className={styles.expand}>
                        {record.rates
                          .filter((item) => item.service_tier !== 'standard')
                          .map((item) => (
                            <p key={item.service_tier}>
                              {item.service_tier}：输入 {unit(item.input)} · 缓存读取 {unit(item.cache_read)} · 缓存写入{' '}
                              {unit(item.cache_write)} · 输出 {unit(item.output)} / 百万 tokens
                            </p>
                          ))}
                      </div>
                    )
                  }}
                />
                </HorizontalDrag>
              </section>

              {imageModels.length > 0 ? (
                <section className={styles.tableCard}>
                  <div className={styles.tableHead}>
                    <h2>
                      图像模型 <small>跟随供应商价目 · 最新在前</small>
                    </h2>
                  </div>
                  <HorizontalDrag watch={imageModels.length}>
                  <Table
                    rowKey={(row) => `${row.model}-${row.service_tier || 'standard'}`}
                    loading={loading}
                    pagination={false}
                    dataSource={imageModels}
                    scroll={{ x: 980 }}
                    columns={[
                      {
                        title: '模型',
                        dataIndex: 'name',
                        render: (_: string, record: (typeof imageModels)[number]) => (
                          <div>
                            <div className={styles.modelCellName}>
                              <Tag color={PROVIDER_META[record.provider].color}>
                                {PROVIDER_META[record.provider].label}
                              </Tag>
                              {record.name}
                              {isPerImageBilling(record) ? (
                                <Tag color="green" style={{ marginLeft: 8 }}>
                                  按张
                                </Tag>
                              ) : (
                                <Tag style={{ marginLeft: 8 }}>tokens</Tag>
                              )}
                            </div>
                            <div className={styles.modelCellId}>{record.model}</div>
                            <div className={styles.modelIntro}>{record.intro}</div>
                          </div>
                        )
                      },
                      {
                        title: '1K / 张',
                        key: 'tier_1k',
                        render: (_: unknown, record: (typeof imageModels)[number]) =>
                          isPerImageBilling(record) ? (
                            <span className={styles.usdOnly}>
                              {formatPrice(record.per_image_tiers?.['1k'] ?? 0)}
                            </span>
                          ) : (
                            <span className={styles.usdOnly}>—</span>
                          )
                      },
                      {
                        title: '2K / 张',
                        key: 'tier_2k',
                        render: (_: unknown, record: (typeof imageModels)[number]) =>
                          isPerImageBilling(record) ? (
                            <span className={styles.usdOnly}>
                              {formatPrice(record.per_image_tiers?.['2k'] ?? 0)}
                            </span>
                          ) : (
                            <span className={styles.usdOnly}>—</span>
                          )
                      },
                      {
                        title: '4K / 张',
                        key: 'tier_4k',
                        render: (_: unknown, record: (typeof imageModels)[number]) =>
                          isPerImageBilling(record) ? (
                            <span className={styles.usdOnly}>
                              {formatPrice(record.per_image_tiers?.['4k'] ?? 0)}
                            </span>
                          ) : (
                            <span className={styles.usdOnly}>—</span>
                          )
                      },
                      {
                        title: '文本输入',
                        dataIndex: 'text_input',
                        render: (v: number, record: (typeof imageModels)[number]) =>
                          isPerImageBilling(record) ? (
                            <span className={styles.usdOnly}>—</span>
                          ) : (
                            <span className={styles.usdOnly}>{formatPrice(v)}</span>
                          )
                      },
                      {
                        title: '图像输入',
                        dataIndex: 'image_input',
                        render: (v: number, record: (typeof imageModels)[number]) =>
                          isPerImageBilling(record) ? (
                            <span className={styles.usdOnly}>—</span>
                          ) : (
                            <span className={styles.usdOnly}>{formatPrice(v)}</span>
                          )
                      },
                      {
                        title: '输出',
                        dataIndex: 'output',
                        render: (v: number, record: (typeof imageModels)[number]) =>
                          isPerImageBilling(record) ? (
                            <span className={styles.usdOnly}>—</span>
                          ) : (
                            <span className={styles.usdOnly}>{formatPrice(v)}</span>
                          )
                      }
                    ]}
                  />
                  </HorizontalDrag>
                  <p className={styles.footnote} style={{ marginTop: 12 }}>
                    图像生成入口：侧栏「绘图」。Teamo GPT Image 按输出最长边分 1K/2K/4K 按张计费；Gemini
                    Image 等按 text / image input / output tokens（USD / 百万 tokens）。价格含站点利润与用户倍率。
                  </p>
                </section>
              ) : null}

              <p className={styles.footnote}>
                列表完全跟随当前供应商价目；本地简介仅作选型参考。单位为美元 / 百万 tokens。长上下文价按整笔请求切换，阈值按非缓存输入、缓存读取与缓存写入合计计算。
              </p>
            </>
          )}
            </>
          )}
        </div>
      </Layout>
    </div>
  )
}

export default PricePage
