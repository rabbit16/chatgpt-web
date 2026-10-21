import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApiOutlined,
  AppstoreAddOutlined,
  ArrowRightOutlined,
  KeyOutlined,
  RocketOutlined
} from '@ant-design/icons'
import { Button, message } from 'antd'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import { DocsPanel } from '@/pages/docs'
import { AgentPanel, RELAY_HOST, RELAY_URL } from '@/pages/agent'
import { SoftwarePanel } from '@/pages/software'
import { copyToClipboard } from '@/utils'
import styles from './index.module.less'

/* ------------------------------------------------------------
   三张小插画：钥匙 / 设置 / 对话
   小清新线条风，底色只用柔蓝、柔黄、柔紫三种。
   ------------------------------------------------------------ */

function ArtKey() {
  return (
    <svg viewBox="0 0 120 96" className={styles.art} aria-hidden>
      <rect x="6" y="6" width="108" height="84" rx="18" fill="var(--tint-brand)" />
      <g fill="none" stroke="var(--brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="46" cy="46" r="15" />
        <path d="M46 31v-7M31 46h-7M61 46h7M46 61v7" />
        <circle cx="46" cy="46" r="4.5" fill="var(--brand)" stroke="none" opacity="0.25" />
        <path d="M74 66h30v14H74z" opacity="0.55" />
        <path d="M80 66v-6h18v6" opacity="0.55" />
      </g>
      <text x="84" y="42" fontSize="13" fill="var(--brand)" fontFamily="monospace" opacity="0.7">
        sk-
      </text>
    </svg>
  )
}

function ArtSettings() {
  return (
    <svg viewBox="0 0 120 96" className={styles.art} aria-hidden>
      <rect x="6" y="6" width="108" height="84" rx="18" fill="var(--tint-amber)" />
      <g fill="none" stroke="#b7791f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="38" cy="40" r="9" />
        <path d="M38 22v6M38 52v6M20 40h6M50 40h6M25 27l4.5 4.5M46.5 48.5L51 53M51 27l-4.5 4.5M29.5 48.5L25 53" />
        <rect x="62" y="28" width="44" height="14" rx="7" />
        <rect x="62" y="50" width="44" height="14" rx="7" />
        <path d="M69 35h16M69 57h10" opacity="0.5" />
      </g>
    </svg>
  )
}

function ArtChat() {
  return (
    <svg viewBox="0 0 120 96" className={styles.art} aria-hidden>
      <rect x="6" y="6" width="108" height="84" rx="18" fill="var(--tint-violet)" />
      <g fill="none" stroke="#6f5cff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M30 30h44a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H48l-10 9v-9h-8a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8Z" />
        <path d="M38 44h28M38 52h18" opacity="0.55" />
        <path d="M86 58c6 0 10 4 10 9s-4 9-10 9h-4l-6 5v-5" opacity="0.7" />
      </g>
    </svg>
  )
}

const STEPS = [
  {
    no: 1,
    art: <ArtKey />,
    title: '先取得一把密钥',
    line: '注册后在页面中生成密钥，复制以 sk- 开头的那一串字符。',
    hint: '密钥相当于门禁凭证，仅显示一次，建议立即保存到密码管理器或备忘录。'
  },
  {
    no: 2,
    art: <ArtSettings />,
    title: '在软件里找到两个输入框',
    line: '打开常用软件的「设置 → 模型 / API」，通常只有两处需要填写：API 地址与 API Key。',
    hint: '各家客户端命名略有差异，但位置一致：设置页里那两行输入框就是。'
  },
  {
    no: 3,
    art: <ArtChat />,
    title: '填入并验证连通',
    line: '地址与密钥各填一行，模型名按价目表原样填写，再发送一句测试消息。',
    hint: '能正常收到回复即表示接入成功；若失败，通常是多打了空格，或地址漏写 /v1。'
  }
]

/**
 * 接入指南（重构版）
 * ------------------------------------------------------------
 * 原先为「三个页签 + 三个值卡片 + 四步流程」，层级过多、术语前置。
 * 现按用户实际执行顺序组织为一条主线：
 *   ① 三张插画说明整体流程 → ② 仅需复制的两项 → ③ 选择软件照着填 → ④ 客户端下载 → ⑤ 接口文档
 * 旧链接 /docs /agent /software 通过 ?tab= 参数落到对应区块，不会失效。
 */
function GuidePage() {
  const [params] = useSearchParams()

  // 旧链接兼容：?tab=client → 选择软件；?tab=download → 下载区块
  useEffect(() => {
    const tab = params.get('tab')
    const target = tab === 'client' ? 'software-guide' : tab === 'download' ? 'download' : ''
    if (!target) return
    const node = document.getElementById(target)
    if (node) {
      window.setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
    }
  }, [params])

  const copy = async (value: string, tip: string) => {
    try {
      await copyToClipboard(value)
      message.success(`已复制${tip}`)
    } catch {
      message.warning('浏览器限制了自动复制，请手动选中复制')
    }
  }

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <ApiOutlined /> 无需编程基础
            </p>
            <h1>把模型接入你正在使用的软件</h1>
            <p className={styles.lead}>
              接入只有两处需要填写：API 地址与 API Key，其余均为选项。以下三张图对应完整流程，
              按顺序执行即可；每一步都为失败情况准备了排查提示。
            </p>
          </header>

          {/* ① 三张插画 */}
          <section className={styles.steps}>
            {STEPS.map((step) => (
              <article key={step.no} className={styles.stepCard}>
                <div className={styles.stepArt}>{step.art}</div>
                <div className={styles.stepBody}>
                  <span className={styles.stepNo}>第 {step.no} 步</span>
                  <h2>{step.title}</h2>
                  <p>{step.line}</p>
                  <small>{step.hint}</small>
                </div>
              </article>
            ))}
          </section>

          {/* ② 仅需复制的两项 */}
          <section className={styles.values}>
            <div className={styles.valuesHead}>
              <IconBadge icon={<KeyOutlined />} tone="brand" size="md" />
              <div>
                <h2>需要复制的只有这两项</h2>
                <p>API 地址固定不变；API Key 每人独立，请在下方「选择软件」第一步中生成。</p>
              </div>
            </div>
            <div className={styles.valueRows}>
              <div className={styles.valueRow}>
                <span className={styles.valueLabel}>API 地址 · 通用（GPT / Gemini / DeepSeek）</span>
                <code>{RELAY_URL}</code>
                <Button size="small" onClick={() => void copy(RELAY_URL, '地址')}>
                  复制
                </Button>
              </div>
              <div className={styles.valueRow}>
                <span className={styles.valueLabel}>API 地址 · Claude 原生格式（结尾不带 /v1）</span>
                <code>{RELAY_HOST}</code>
                <Button size="small" onClick={() => void copy(RELAY_HOST, '地址')}>
                  复制
                </Button>
              </div>
              <div className={styles.valueRow}>
                <span className={styles.valueLabel}>API Key · 每人独立</span>
                <code>sk-…（下一步生成）</code>
                <Button size="small" type="link" onClick={() => scrollTo('software-guide')}>
                  去生成 <ArrowRightOutlined />
                </Button>
              </div>
            </div>
            <p className={styles.valuesFoot}>
              不确定该选哪一条时，优先使用带 <code>/v1</code> 的通用地址，绝大多数客户端均兼容。
            </p>
          </section>

          {/* ③ 选择软件照着填 */}
          <section id="software-guide" className={styles.block}>
            <div className={styles.blockHead}>
              <IconBadge icon={<AppstoreAddOutlined />} tone="mint" size="md" />
              <div>
                <h2>选择你正在使用的软件</h2>
                <p>
                  选中软件后，下方会给出准确的填写位置、字段内容与模型选择建议。列表中没有你的软件时，选择「其他」按通用方式填写。
                </p>
              </div>
            </div>
            <AgentPanel />
          </section>

          {/* ④ 客户端下载 */}
          <section id="download" className={styles.block}>
            <div className={styles.blockHead}>
              <IconBadge icon={<RocketOutlined />} tone="violet" size="md" />
              <div>
                <h2>还没有客户端？先下载</h2>
                <p>下列客户端均免费提供，安装完成后回到第 2 步填写两处即可使用。</p>
              </div>
            </div>
            <SoftwarePanel />
          </section>

          {/* ⑤ 接口文档 */}
          <section id="api-docs" className={styles.block}>
            <div className={styles.blockHead}>
              <IconBadge icon={<ApiOutlined />} tone="amber" size="md" />
              <div>
                <h2>需要自行编写代码调用</h2>
                <p>接口与 OpenAI 官方格式一致，将 base_url 替换为上方地址、填入你的 API Key 即可。</p>
              </div>
            </div>
            <DocsPanel />
          </section>
        </div>
      </Layout>
    </div>
  )
}

export default GuidePage
