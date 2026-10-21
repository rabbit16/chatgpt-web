import { useState } from 'react'
import { Button, Tag, message } from 'antd'
import { Link } from 'react-router-dom'
import {
  ApiOutlined,
  AppstoreOutlined,
  CheckOutlined,
  CodeOutlined,
  CopyOutlined,
  KeyOutlined,
  RocketOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import Layout from '@/components/Layout'
import IconBadge, { type IconBadgeTone } from '@/components/IconBadge'
import { userStore } from '@/store'
import styles from './index.module.less'

/** 站点对外基础地址：本站所有协议都挂在这个 /v1 之下 */
const BASE_URL = 'https://www.rabbitj.top/v1'

const curlSample = `curl ${BASE_URL}/chat/completions \\
  -H "Authorization: Bearer sk-你的密钥" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-6.1-sol",
    "messages": [{ "role": "user", "content": "你好" }],
    "stream": true
  }'`

const sdkSample = `from openai import OpenAI

client = OpenAI(
    base_url="${BASE_URL}",
    api_key="sk-你的密钥",
)

resp = client.chat.completions.create(
    model="gpt-6.1-sol",
    messages=[{"role": "user", "content": "你好"}],
)
print(resp.choices[0].message.content)`

const clients: { name: string; detail: string; icon: React.ReactNode; tone: IconBadgeTone }[] = [
  {
    icon: <AppstoreOutlined />,
    tone: 'rose',
    name: 'Cherry Studio',
    detail: '设置 → 模型服务 → 添加 OpenAI 兼容服务，API 地址填上面的 base_url，密钥填 sk- 开头的那串。'
  },
  {
    icon: <CodeOutlined />,
    tone: 'violet',
    name: 'Claude Code',
    detail: '导出 ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN 两个环境变量，模型名用本站价目表里的 Claude 型号。'
  },
  {
    icon: <ApiOutlined />,
    tone: 'mint',
    name: 'OpenAI SDK / 其他工具',
    detail: '任何支持自定义 base_url 的客户端都能接入：base_url 填 /v1 结尾的地址，协议选 OpenAI 兼容即可。'
  }
]

const faqs = [
  {
    q: '报 401 / missing API key 怎么办？',
    a: '密钥没带上或被截断。检查请求头是否为 Authorization: Bearer sk-…，以及密钥是否已被删除。'
  },
  {
    q: '模型名怎么写？',
    a: '用「模型价格」页里列出的名称原样填写，例如 gpt-6.1-sol、claude-sonnet-5；带括号的 fast 版本需要一起写。'
  },
  {
    q: '为什么我看到的价和页面不一样？',
    a: '价格页显示的是标准参考价，登录后按你的等级与折扣计算实际单价，以「使用记录」的扣费为准。'
  },
  {
    q: '余额不足会怎样？',
    a: '请求会被拒绝并返回余额不足提示；在「商城」充值后立即生效，无需重启客户端。'
  }
]

/**
 * 接入文档（S4）
 * ------------------------------------------------------------
 * 目的：让"想接的人"在一屏内拿到三样东西 —— 地址、密钥入口、可复制的第一条请求。
 * 不做花活：没有 3D、没有动画，只有可抄走的代码。
 */
function DocsPage() {
  const setLoginModal = userStore((state) => state.setLoginModal)
  const token = userStore((state) => state.token)
  const [copied, setCopied] = useState(false)

  const copyBase = async () => {
    try {
      await navigator.clipboard.writeText(BASE_URL)
      setCopied(true)
      message.success('已复制基础地址')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      message.warning('浏览器不允许自动复制，请手动选中复制')
    }
  }

  return (
    <div className={styles.docsPage}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <ApiOutlined /> 兼容 OpenAI 协议 · Claude · Gemini
            </p>
            <h1>接入文档</h1>
            <p className={styles.desc}>三步把兔子网站接到你的工具里，只需要一个基础地址和一把密钥。</p>
          </header>

          <section className={styles.baseBox}>
            <div className={styles.baseLabel}>API 基础地址</div>
            <div className={styles.baseRow}>
              <code className={styles.baseUrl}>{BASE_URL}</code>
              <Button icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={() => void copyBase()}>
                {copied ? '已复制' : '复制'}
              </Button>
            </div>
          </section>

          <section className={styles.steps}>
            <div className={styles.step}>
              <IconBadge icon={<span className={styles.stepNumText}>1</span>} tone="brand" size="md" />
              <div>
                <h3>创建 API 密钥</h3>
                <p>注册后进入「API 密钥」页生成 sk- 开头的密钥，只显示一次，请立刻保存。</p>
                <Button
                  type="link"
                  size="small"
                  className={styles.stepLink}
                  onClick={() => (token ? undefined : setLoginModal(true))}
                >
                  {token ? <Link to="/agent">去创建密钥 →</Link> : '登录后创建 →'}
                </Button>
              </div>
            </div>
            <div className={styles.step}>
              <IconBadge icon={<span className={styles.stepNumText}>2</span>} tone="amber" size="md" />
              <div>
                <h3>选择协议</h3>
                <p>
                  同一个地址支持三种协议：<Tag>OpenAI 兼容</Tag>
                  <Tag>Claude Messages</Tag>
                  <Tag>Gemini</Tag>
                </p>
              </div>
            </div>
            <div className={styles.step}>
              <IconBadge icon={<span className={styles.stepNumText}>3</span>} tone="mint" size="md" />
              <div>
                <h3>发送第一条请求</h3>
                <p>把下面的命令里的密钥换成你自己的，模型名换成本站价目表里的名称。</p>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                <IconBadge icon={<ThunderboltOutlined />} tone="amber" size="sm" /> curl 示例
              </span>
              <code className={styles.monoLabel}>POST /v1/chat/completions</code>
            </div>
            <pre className={styles.code}>{curlSample}</pre>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>
                <IconBadge icon={<KeyOutlined />} tone="violet" size="sm" /> OpenAI SDK（Python）
              </span>
              <code className={styles.monoLabel}>openai &gt;= 1.0</code>
            </div>
            <pre className={styles.code}>{sdkSample}</pre>
          </section>

          <section className={styles.clientGrid}>
            {clients.map((item) => (
              <div key={item.name} className={styles.clientCard}>
                <IconBadge icon={item.icon} tone={item.tone} size="md" />
                <h3>{item.name}</h3>
                <p>{item.detail}</p>
              </div>
            ))}
          </section>

          <section className={styles.faq}>
            <h2>常见问题</h2>
            {faqs.map((item) => (
              <div key={item.q} className={styles.faqItem}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </section>

          <section className={styles.cta}>
            <div>
              <h2>还没账号？</h2>
              <p>注册送体验额度，先跑通第一条请求再决定充多少。</p>
            </div>
            <div className={styles.ctaActions}>
              <Button type="primary" size="large" icon={<RocketOutlined />} onClick={() => setLoginModal(true)}>
                免费注册
              </Button>
              <Link to="/price" className={styles.ctaSecondary}>
                查看价格
              </Link>
            </div>
          </section>
        </div>
      </Layout>
    </div>
  )
}

export default DocsPage
