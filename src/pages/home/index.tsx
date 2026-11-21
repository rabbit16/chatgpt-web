import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Button } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { PUBLIC_MODELS, PUBLIC_PRICING_UPDATED_AT } from '@/data/publicPricing'
import rabbitLogo from '@/assets/brand/rabbitj-a2.svg'
import { getUserPricing, type UserModelRate } from '@/request/api'
import { userStore } from '@/store'
import styles from './index.module.less'

type FeaturedModel = {
  id: string
  label: string
  rate?: UserModelRate
  live: boolean
}

const FEATURED_MODELS = [
  { id: 'deepseek-flash-1017', label: 'DeepSeek' },
  { id: 'gpt-5.4-mini', label: 'GPT' },
  { id: 'claude-sonnet-5-5', label: 'Claude' }
]

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '暂无报价'
  if (value === 0) return '$0'
  if (value < 0.01) return `$${value.toExponential(2)}`
  return `$${Number(value.toFixed(6))}`
}

/**
 * 官方价对照 + 橙色折扣标（2026-11-20 站长：价签卡要突出折扣）
 * ------------------------------------------------------------
 * 与价格页 PriceComparison 同一套口径：官方价划线、折扣 = 现价 / 官方价 × 10。
 * 官方价缺失（接口没给 original_*）就整块不渲染，宁可空着也不写「待核实」占位。
 * 输入/输出两行各比各的，只有至少一行有官方价时才显示。
 */
function OfficialCompare({
  input,
  output,
  officialInput,
  officialOutput
}: {
  input?: number
  output?: number
  officialInput?: number | null
  officialOutput?: number | null
}) {
  const rows = [
    { label: '输入', current: input, official: officialInput },
    { label: '输出', current: output, official: officialOutput }
  ].filter(
    (row): row is { label: string; current: number; official: number } =>
      typeof row.current === 'number' &&
      Number.isFinite(row.current) &&
      typeof row.official === 'number' &&
      Number.isFinite(row.official) &&
      row.official > 0 &&
      // 与官方价持平（≈10 折）不算折扣，整行不显示，避免「10.0 折」的噪音（2026-11-20 截图验收）
      (row.current / row.official < 0.995 || row.current / row.official > 1.005)
  )
  if (!rows.length) return null

  return (
    <div className={styles.officialCompare}>
      {rows.map((row) => {
        const discounted = row.current < row.official
        return (
          <span key={row.label} className={styles.officialRow}>
            <em>
              {row.label}官方价 <del>{formatPrice(row.official)}</del>
            </em>
            <b className={discounted ? styles.discountTag : styles.discountTagPlain}>
              {discounted ? `${((row.current / row.official) * 10).toFixed(1)} 折` : '高于官方价'}
            </b>
          </span>
        )
      })}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { token, llm_api_key } = userStore()
  const [rates, setRates] = useState<UserModelRate[]>([])
  const [pricingDate, setPricingDate] = useState('')
  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState('')

  const hasCredential = Boolean((llm_api_key || '').trim())
  const featuredModels = useMemo<FeaturedModel[]>(
    () =>
      FEATURED_MODELS.map((item) => {
        const current = rates.find(
          (rate) => rate.model === item.id && rate.service_tier === 'standard'
        )
        const reference = PUBLIC_MODELS.find(
          (rate) => rate.model === item.id && rate.service_tier === 'standard'
        )
        return { ...item, rate: current || reference, live: Boolean(current) }
      }),
    [rates]
  )

  useEffect(() => {
    if (!token || !hasCredential) {
      setRates([])
      setPricingDate('')
      setPricingError('')
      return
    }

    const controller = new AbortController()
    setPricingLoading(true)
    setPricingError('')
    getUserPricing({ signal: controller.signal })
      .then((pricing) => {
        if (!Array.isArray(pricing.models)) throw new Error('价目数据不完整')
        setRates(pricing.models)
        setPricingDate(pricing.vendor?.last_synced_at || '')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setRates([])
        setPricingError(error instanceof Error ? error.message : '获取当前价目失败')
      })
      .finally(() => {
        if (!controller.signal.aborted) setPricingLoading(false)
      })

    return () => controller.abort()
  }, [token, hasCredential])

  const currentPrices = Boolean(rates.length)

  return (
    <Layout homeAppearance>
      <main className={styles.home}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <i /> 多模型接入 · 价格清晰
            </span>
            <h1>
              <span className={styles.heroIntro}>Agent 接入大模型，</span>
              <br />
              <strong>本站优惠约三折</strong>
            </h1>
            <div className={styles.actions}>
              <Button type="primary" size="large" onClick={() => navigate('/agent#api-keys')}>
                获取 API Key <span aria-hidden="true">→</span>
              </Button>
              <Button size="large" onClick={() => navigate('/price')}>
                探索模型价格
              </Button>
            </div>
          </div>

          <div className={styles.network} aria-label="常用工具经 rabbitJ 连接模型的示意图">
            {/**
             * 折线流程图 + 信息光球（2026-11-20 站长，第二版）
             * ------------------------------------------------------------
             * 站长看完第一版的意见：光球被 SVG 非等比拉伸压成了椭圆，
             * 颜色也不要跟线走——统一「绿色送过去，黄色带回来」；
             * 左右卡片要上下左右对齐；线要连进卡片里，光球从卡片下面穿过去。
             *
             * 落地：线仍是 SVG（圆角折线 + 虚线流动，端点延长到卡片底下）；
             * 光球改成 HTML 圆点（永远正圆），按折线轨迹的关键帧跑，
             * 两层光晕（绿/黄）用透明度在两端点处互换，变色藏在卡片下面。
             * 层级：线 z-index:-1 < 光球 1 < 卡片/枢纽 2。
             */}
            <svg
              className={styles.flow}
              viewBox="0 0 1000 300"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                className={`${styles.flowLine} ${styles.flowLineBlue}`}
                d="M-20,33 H380 Q395,33 395,48 V120 Q395,135 410,135 H500"
              />
              <path
                className={`${styles.flowLine} ${styles.flowLineBlue}`}
                d="M500,135 H590 Q605,135 605,120 V48 Q605,33 620,33 H1020"
              />
              <path className={`${styles.flowLine} ${styles.flowLinePurple}`} d="M-20,150 H500" />
              <path className={`${styles.flowLine} ${styles.flowLinePurple}`} d="M500,150 H1020" />
              <path
                className={`${styles.flowLine} ${styles.flowLineOrange}`}
                d="M-20,267 H380 Q395,267 395,252 V180 Q395,165 410,165 H500"
              />
              <path
                className={`${styles.flowLine} ${styles.flowLineOrange}`}
                d="M500,165 H590 Q605,165 605,180 V252 Q605,267 620,267 H1020"
              />
            </svg>
            <span
              className={`${styles.orb} ${styles.orbTop}`}
              style={{ '--dur': '7s', '--del': '0s' } as CSSProperties}
              aria-hidden="true"
            >
              <i className={styles.orbGo} />
              <i className={styles.orbBack} />
            </span>
            <span
              className={`${styles.orb} ${styles.orbMid}`}
              style={{ '--dur': '8s', '--del': '-2.6s' } as CSSProperties}
              aria-hidden="true"
            >
              <i className={styles.orbGo} />
              <i className={styles.orbBack} />
            </span>
            <span
              className={`${styles.orb} ${styles.orbBottom}`}
              style={{ '--dur': '9s', '--del': '-5.2s' } as CSSProperties}
              aria-hidden="true"
            >
              <i className={styles.orbGo} />
              <i className={styles.orbBack} />
            </span>
            <span className={`${styles.networkNode} ${styles.nodeOne}`}>Agent 工具</span>
            <span className={`${styles.networkNode} ${styles.nodeTwo}`}>网页对话</span>
            <span className={`${styles.networkNode} ${styles.nodeThree}`}>API 接入</span>
            <span className={`${styles.networkNode} ${styles.nodeFour}`}>DeepSeek</span>
            <span className={`${styles.networkNode} ${styles.nodeFive}`}>Claude</span>
            <span className={`${styles.networkNode} ${styles.nodeSix}`}>更多模型</span>
            <span className={styles.hub}>
              <img src={rabbitLogo} alt="rabbitJ" />
            </span>
            <small>连接示意 · 实际支持情况以本站为准</small>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <span className={styles.sectionEyebrow}>PRICE PREVIEW</span>
              <h2>三款模型，价格一眼看</h2>
            </div>
            <Link to="/price">查看完整价目 →</Link>
          </div>
          <div className={styles.priceGrid}>
            {featuredModels.map(({ id, label, rate, live }) => (
              <Link
                key={id}
                className={styles.priceCard}
                to={`/price?model=${encodeURIComponent(id)}#estimate`}
              >
                <div className={styles.priceCardHead}>
                  <span>{label}</span>
                  <span>{pricingLoading ? '正在更新' : live ? '当前账号价' : '访客参考价'}</span>
                </div>
                <h3>{rate?.display_name || rate?.model || id}</h3>
                <div className={styles.priceValues}>
                  <span>
                    输入 <strong>{rate ? formatPrice(rate.input) : '暂无报价'}</strong>
                    <small>/ 百万 tokens</small>
                  </span>
                  <span>
                    输出 <strong>{rate ? formatPrice(rate.output) : '暂无报价'}</strong>
                    <small>/ 百万 tokens</small>
                  </span>
                </div>
                <OfficialCompare
                  input={rate?.input}
                  output={rate?.output}
                  officialInput={rate?.original_input}
                  officialOutput={rate?.original_output}
                />
                <span className={styles.cardLink}>
                  查看计费档位与缓存价格 <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
          <p className={styles.priceNote} role="status">
            {currentPrices
              ? `价格来自当前账号价目${
                  pricingDate ? ` · 同步 ${new Date(pricingDate).toLocaleDateString('zh-CN')}` : ''
                }${
                  featuredModels.some((model) => !model.live)
                    ? '；未返回的型号沿用带日期的访客参考价'
                    : ''
                }。`
              : token && !hasCredential
              ? '当前账号尚无 API Key，暂不展示个人实时价。登录后到接入页创建密钥，再查看当前账号价目。'
              : pricingError
              ? `当前价目暂时无法获取。${pricingError} 登录后可在模型价格页重试。`
              : `访客参考价取自 ${PUBLIC_PRICING_UPDATED_AT} 的公开快照，仅供参考。登录并配置 API Key 后可查看当前账号价目。`}
          </p>
        </section>

      </main>
    </Layout>
  )
}
