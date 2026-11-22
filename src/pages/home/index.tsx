import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Button } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import Layout from '@/components/Layout'
import { PUBLIC_MODELS, PUBLIC_PRICING_UPDATED_AT } from '@/data/publicPricing'
import rabbitLogo from '@/assets/brand/rabbitj-a2.svg'
import { getStandardPrice, formatTokenPrice, pickHomePriceModels } from '@/data/displayPricing'
import { PROVIDER_META } from '@/data/modelPricing'
import { demoEnabled } from '@/demo/runtime'
import { getPricingCredential, getUserPricing, type UserPricing } from '@/request/api'
import { userStore } from '@/store'
import styles from './index.module.less'

const previewMetrics = [{ key: 'input', label: '输入' }, { key: 'output', label: '输出' }] as const
const publicPreview = pickHomePriceModels(PUBLIC_MODELS, 'USD')

export default function HomePage() {
  const navigate = useNavigate()
  const { token, llm_api_key, user_info } = userStore()
  const credential = getPricingCredential(llm_api_key, user_info)
  const [accountPricing, setAccountPricing] = useState<{
    token: string
    credential: string
    pricing: UserPricing
  } | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const pricing = token && accountPricing?.token === token && accountPricing.credential === credential
    ? accountPricing.pricing
    : null
  const accountModels = useMemo(
    () => pricing ? pickHomePriceModels(pricing.models, pricing.currency) : [],
    [pricing]
  )
  const live = accountModels.length > 0
  const featuredModels = live ? accountModels : publicPreview

  useEffect(() => {
    setAccountPricing(null)
    if (!token || (!credential && !demoEnabled)) {
      setPricingLoading(false)
      return
    }

    const controller = new AbortController()
    setPricingLoading(true)
    getUserPricing({ signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        if (!Array.isArray(data.models)) throw new Error('价目数据不完整')
        setAccountPricing({ token, credential, pricing: data })
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setPricingLoading(false)
      })

    return () => controller.abort()
  }, [token, credential])

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
              <h2>近期模型价格</h2>
            </div>
            <Link to="/price">查看完整价目 →</Link>
          </div>
          <div className={styles.priceGrid}>
            {featuredModels.map(({ model, rate }) => (
              <Link
                key={rate.model}
                className={styles.priceCard}
                to={`/price?model=${encodeURIComponent(rate.model)}#estimate`}
              >
                <article>
                  <header className={styles.priceCardHead}>
                    <span>{PROVIDER_META[model.provider].label}</span>
                    <span>美元 / 百万 tokens</span>
                  </header>
                  <h3>{model.name}</h3>
                  <dl className={styles.priceValues}>
                    {previewMetrics.map(({ key, label }) => {
                      const standard = live && pricing ? getStandardPrice(rate, key, pricing) : undefined
                      return (
                        <div key={key}>
                          <dt>{label}</dt>
                          {live && (
                            <dd className={styles.standardPrice}>
                              站内标准价 {standard === undefined ? '暂无' : formatTokenPrice(standard)}
                            </dd>
                          )}
                          <dd>
                            <small>{live ? '当前账号价' : '访客参考标准价'}</small>
                            <strong>{formatTokenPrice(rate[key])}</strong>
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                  <span className={styles.cardLink}>
                    查看计费档位与缓存价格 <span aria-hidden="true">→</span>
                  </span>
                </article>
              </Link>
            ))}
          </div>
          <p className={styles.priceNote} role="status">
            {live
              ? '所列为标准档报价。站内标准价为应用账号折扣前的价格。'
              : `${pricingLoading ? '正在获取账号价格。' : token ? '账号价格暂不可用。' : ''}访客参考价来自 ${PUBLIC_PRICING_UPDATED_AT} 的公开价目。`}
          </p>
        </section>

      </main>
    </Layout>
  )
}
