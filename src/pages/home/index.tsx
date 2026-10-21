import { useMemo } from 'react'
import { Button, Tag } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import {
  ApiOutlined,
  ArrowRightOutlined,
  BookOutlined,
  CheckCircleFilled,
  ExperimentOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WalletOutlined
} from '@ant-design/icons'
import IconBadge from '@/components/IconBadge'
import Layout from '@/components/Layout'
import { userStore } from '@/store'
import { PUBLIC_MODELS } from '@/data/publicPricing'
import { PROVIDER_META, type ModelProvider } from '@/data/modelPricing'
import styles from './index.module.less'

const BASE_URL = 'https://www.rabbitj.top/v1'

/** 首页只展示"好看的数字"：小于 1 的保留 4 位有效小数，大于 1 的保留 2–3 位 */
function priceLabel(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value >= 10) return `$${value.toFixed(1)}`
  if (value >= 1) return `$${value.toFixed(2)}`
  if (value >= 0.1) return `$${value.toFixed(3)}`
  return `$${value.toFixed(4)}`
}

/** 上游字段偶发为空时，用模型名前缀兜底，避免卡片上出现"通用"这种糊弄字 */
function guessProvider(id: string): string {
  if (/^gpt|^o[1-9]|^dall|^text-embedding/.test(id)) return 'OpenAI'
  if (/^claude/.test(id)) return 'Claude'
  if (/^gemini|^image-|^veo/.test(id)) return 'Google'
  if (/^deepseek/.test(id)) return 'DeepSeek'
  if (/^grok/.test(id)) return 'xAI'
  if (/^glm/.test(id)) return '智谱'
  return 'OpenAI 兼容'
}

/** 首页价格预览挑 4 个有代表性的模型：主力、旗舰、便宜、国产 */
const FEATURED = ['gpt-6.1-sol', 'claude-sonnet-5', 'gemini-3.5-flash', 'deepseek-v4-pro']

const steps = [
  {
    no: 1,
    tone: 'brand' as const,
    title: '创建密钥',
    desc: '注册后在「API 密钥」生成 sk- 开头的密钥'
  },
  {
    no: 2,
    tone: 'amber' as const,
    title: '填入地址',
    desc: `把 base_url 设为 ${BASE_URL}`
  },
  {
    no: 3,
    tone: 'mint' as const,
    title: '发出请求',
    desc: '用任意 OpenAI 兼容客户端发第一条消息'
  }
]

const features = [
  {
    icon: <ApiOutlined />,
    tone: 'brand' as const,
    title: '一个地址，多家模型',
    desc: 'OpenAI / Claude / Gemini 三种协议都挂在同一个 /v1 下，换模型只改一个字段。'
  },
  {
    icon: <WalletOutlined />,
    tone: 'mint' as const,
    title: '按量付费，账目清楚',
    desc: '没有订阅绑定；每次请求的 token 与扣费都能在「使用记录」里核对。'
  },
  {
    icon: <SafetyCertificateOutlined />,
    tone: 'violet' as const,
    title: '密钥自己管',
    desc: '密钥由你自己创建、随时吊销；余额、用量、密钥都在控制台里，不经过第三方。'
  }
]

function HomePage() {
  const navigate = useNavigate()
  const setLoginModal = userStore((state) => state.setLoginModal)
  const token = userStore((state) => state.token)

  const stats = useMemo(() => {
    const providers = new Set(PUBLIC_MODELS.map((m) => (m.owned_by || '').toLowerCase()).filter(Boolean))
    return {
      models: new Set(PUBLIC_MODELS.map((m) => m.model)).size,
      providers: providers.size
    }
  }, [])

  const pricePreview = useMemo(() => {
    return FEATURED.map((id) => {
      const rows = PUBLIC_MODELS.filter((m) => m.model === id && m.service_tier === 'standard')
      const row = rows[0]
      if (!row) return null
      const provider = (row.owned_by || '') as ModelProvider
      return {
        id,
        name: row.display_name || row.model,
        provider: PROVIDER_META[provider]?.label || row.owned_by || guessProvider(id),
        input: priceLabel(row.input),
        output: priceLabel(row.output)
      }
    }).filter(Boolean) as { id: string; name: string; provider: string; input: string; output: string }[]
  }, [])

  return (
    <div className={styles.home}>
      <Layout>
        {/* ---------- Hero：一屏一主张 ---------- */}
        <section className={styles.hero}>
          <span className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>
                <ThunderboltOutlined /> 多模型 API 中转
              </span>
              <h1 className={styles.title}>
                一个地址，
                <br />
                接通主流大模型
              </h1>
              <p className={styles.subtitle}>
                兼容 OpenAI 协议，一个密钥调度 GPT、Claude、Gemini 等 {stats.models} 个模型。
                按实际用量付费，余额与账单随时可查。
              </p>

              <div className={styles.ctas}>
                <Button
                  type="primary"
                  size="large"
                  icon={token ? <ExperimentOutlined /> : <RocketOutlined />}
                  onClick={() => (token ? navigate('/chat') : setLoginModal(true))}
                >
                  {token ? '进入对话' : '免费注册'}
                </Button>
                <Button size="large" onClick={() => navigate('/price')}>
                  查看价格
                </Button>
              </div>

              <div className={styles.heroMeta}>
                <span>
                  <CheckCircleFilled /> 无需绑卡
                </span>
                <span>
                  <CheckCircleFilled /> 匿名可先体验
                </span>
                <span>
                  <CheckCircleFilled /> 密钥随时吊销
                </span>
              </div>
            </div>

            {/* 右侧：一段真实可抄的请求，比形容词更能说明问题 */}
            <div className={styles.codeCard}>
              <div className={styles.codeHead}>
                <span className={styles.codeDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className={styles.codeTitle}>POST /v1/chat/completions</span>
                <Tag color="success" bordered={false}>
                  200 OK
                </Tag>
              </div>
              <pre className={styles.code}>{`curl ${BASE_URL}/chat/completions \\
  -H "Authorization: Bearer sk-••••••" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-6.1-sol",
    "messages": [{ "role": "user",
                   "content": "你好" }],
    "stream": true
  }'`}</pre>
              {/* 窄屏换一段更短的示例，避免横向裁切看着像坏掉 */}
              <pre className={`${styles.code} ${styles.codeNarrow}`}>{`curl https://www.rabbitj.top\\
/v1/chat/completions \\
  -H "Authorization: Bearer sk-••" \\
  -d '{"model":"gpt-6.1-sol",
       "messages":[{"role":"user",
                    "content":"你好"}]}'`}</pre>
              <div className={styles.codeFoot}>
                <span>接入文档</span>
                <Link to="/docs" className={styles.codeLink}>
                  看完整示例 <ArrowRightOutlined />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 数据条：可核对的事实 ---------- */}
        <section className={styles.statsBar}>
          <div className={styles.stat}>
            <b className="num">{stats.models}</b>
            <span>个可用模型</span>
          </div>
          <div className={styles.stat}>
            <b className="num">{stats.providers}</b>
            <span>家上游供应商</span>
          </div>
          <div className={styles.stat}>
            <b>3</b>
            <span>种协议兼容</span>
          </div>
          <div className={styles.stat}>
            <b>按量</b>
            <span>计费，无订阅</span>
          </div>
        </section>

        {/* ---------- 价格预览 ---------- */}
        <section id="pricing" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>常用模型价格</h2>
              <p>标准参考价，单位为美元 / 百万 tokens；注册后按你的等级计算实际单价。</p>
            </div>
            <Link to="/price" className={styles.moreLink}>
              全部 {stats.models} 个模型 <ArrowRightOutlined />
            </Link>
          </div>
          <div className={styles.priceGrid}>
            {pricePreview.map((item) => (
              <Link key={item.id} to="/price" className={styles.priceCard}>
                <span className={styles.priceProvider}>{item.provider}</span>
                <strong className={styles.priceName}>{item.name}</strong>
                <div className={styles.priceRow}>
                  <span>输入</span>
                  <b className="num">{item.input}</b>
                </div>
                <div className={styles.priceRow}>
                  <span>输出</span>
                  <b className="num">{item.output}</b>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- 三步接入 ---------- */}
        <section id="how" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>三步接入</h2>
              <p>不用改代码框架，任何支持自定义 base_url 的客户端都能用。</p>
            </div>
            <Link to="/docs" className={styles.moreLink}>
              <BookOutlined /> 接入文档
            </Link>
          </div>
          <div className={styles.stepGrid}>
            {steps.map((step) => (
              <div key={step.no} className={styles.stepCard}>
                <IconBadge icon={<span className={styles.stepNo}>{step.no}</span>} tone={step.tone} size="lg" />
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- 为什么是这里 ---------- */}
        <section id="why" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>为什么用兔子网站</h2>
              <p>只写能兑现的三件事。</p>
            </div>
          </div>
          <div className={styles.featureGrid}>
            {features.map((item) => (
              <div key={item.title} className={styles.featureCard}>
                <IconBadge icon={item.icon} tone={item.tone} size="lg" />
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- 体验入口 ---------- */}
        <section className={styles.experience}>
          <div>
            <h2>先试试再说</h2>
            <p>不注册也能直接对话和绘图，只是历史不会保存；满意了再拿密钥接入自己的工具。</p>
          </div>
          <div className={styles.experienceActions}>
            <Button size="large" icon={<ExperimentOutlined />} onClick={() => navigate('/chat')}>
              在线体验
            </Button>
            {!token && (
              <Button type="link" size="large" onClick={() => setLoginModal(true)}>
                先注册一个账号 <ArrowRightOutlined />
              </Button>
            )}
          </div>
        </section>

        {/* ---------- 底部 CTA ---------- */}
        <section className={styles.finalCta}>
          <span className={styles.finalGlow} aria-hidden="true" />
          <h2>把模型接进你的工作流</h2>
          <p>注册后创建密钥，5 分钟跑通第一条请求。</p>
          <div className={styles.finalActions}>
            <Button
              type="primary"
              size="large"
              icon={token ? <ExperimentOutlined /> : <RocketOutlined />}
              onClick={() => (token ? navigate('/chat') : setLoginModal(true))}
            >
              {token ? '继续对话' : '免费注册'}
            </Button>
            <Link to="/price" className={styles.finalSecondary}>
              先看看价格
            </Link>
          </div>
        </section>

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} anyGPT · 中转服务</span>
          <span className={styles.footerLinks}>
            <Link to="/price">模型价格</Link>
            <Link to="/docs">接入文档</Link>
            <Link to="/notice">公告留言</Link>
          </span>
        </footer>
      </Layout>
    </div>
  )
}

export default HomePage
