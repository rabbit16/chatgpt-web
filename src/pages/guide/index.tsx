import { useSearchParams } from 'react-router-dom'
import { ApiOutlined, AppstoreAddOutlined, BookOutlined, CopyOutlined, RocketOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import Layout from '@/components/Layout'
import PillTabs from '@/components/PillTabs'
import IconBadge from '@/components/IconBadge'
import { DocsPanel } from '@/pages/docs'
import { AgentPanel, RELAY_HOST, RELAY_URL } from '@/pages/agent'
import { SoftwarePanel } from '@/pages/software'
import { copyToClipboard } from '@/utils'
import styles from './index.module.less'

type TabKey = 'start' | 'client' | 'download'

const TABS: { key: TabKey; label: string; icon: JSX.Element }[] = [
  { key: 'start', label: '快速开始', icon: <BookOutlined /> },
  { key: 'client', label: '各软件怎么填', icon: <AppstoreAddOutlined /> },
  { key: 'download', label: '软件下载', icon: <RocketOutlined /> }
]

/** 整个接入只需要记住这三样东西 */
const VALUES = [
  {
    title: '接口地址（Base URL）',
    tip: 'GPT / Gemini / DeepSeek 系填这个，结尾带 /v1',
    value: RELAY_URL
  },
  {
    title: '接口地址（Claude 系）',
    tip: 'Claude 模型这条规则不同，结尾不带 /v1',
    value: RELAY_HOST
  },
  {
    title: 'API Key',
    tip: '在下面第 1 步生成，sk- 开头，只显示一次',
    value: 'sk-...（自己生成）'
  }
]

const FLOW = [
  { no: 1, title: '注册并生成密钥', desc: '注册后在「接入指南 → 快速开始」生成 sk- 密钥，复制保存。' },
  { no: 2, title: '打开软件的设置', desc: '找到「API 地址 / Base URL」和「API Key」两个输入框。' },
  { no: 3, title: '粘贴地址和密钥', desc: '地址按模型选带不带 /v1，密钥整串粘贴，不要多空格。' },
  { no: 4, title: '选模型名，发一句话', desc: '模型名照价目表原样填；能收到回复就算接通了。' }
]

/**
 * 接入指南（合并原「接入文档」「Agent 接入」「软件下载」）
 * ------------------------------------------------------------
 * 为什么合并：这三页讲的是同一件事被拆成了三个入口，用户不知道该看哪个。
 * 现在一页三页签：先看懂（快速开始）→ 对着软件填（各软件怎么填）→ 下客户端（软件下载）。
 * 页面顶部固定给出「三个值」和「四步流程」，任何一个小白都能照着做。
 */

/** 软件设置界面示意图：让"填哪两个框"有画面感，不用真的截图也能看懂 */
function SettingsMock() {
  return (
    <div className={styles.mock} aria-label="软件设置界面示意">
      <div className={styles.mockBar}>
        <span className={styles.mockDot} />
        <span className={styles.mockDot} />
        <span className={styles.mockDot} />
        <span className={styles.mockTitle}>软件设置 · 添加服务商</span>
      </div>
      <div className={styles.mockBody}>
        <div className={styles.mockRow}>
          <label>服务商类型</label>
          <div className={styles.mockInput}>OpenAI 兼容 / Custom</div>
        </div>
        <div className={`${styles.mockRow} ${styles.mockKey}`}>
          <label>API 地址（Base URL）</label>
          <div className={styles.mockInput}>{RELAY_URL}</div>
          <span className={styles.mockNo}>②</span>
        </div>
        <div className={`${styles.mockRow} ${styles.mockKey}`}>
          <label>API Key</label>
          <div className={styles.mockInput}>sk-••••••••••••••••</div>
          <span className={styles.mockNo}>①③</span>
        </div>
        <div className={`${styles.mockRow} ${styles.mockKey}`}>
          <label>模型</label>
          <div className={styles.mockInput}>gpt-5.4（写代码） / gpt-image-…（画图）</div>
          <span className={styles.mockNo}>④</span>
        </div>
      </div>
      <p className={styles.mockFoot}>
        图里高亮的三个框，就是第 1–4 步要动的地方；其它选项保持默认。
      </p>
    </div>
  )
}

function GuidePage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: TabKey = raw === 'client' || raw === 'download' ? raw : 'start'

  const switchTab = (next: string) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'start') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const copy = async (value: string) => {
    try {
      await copyToClipboard(value)
      message.success('已复制')
    } catch {
      message.warning('浏览器不允许自动复制，请手动选中')
    }
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <ApiOutlined /> 兼容 OpenAI / Claude / Gemini 协议
            </p>
            <h1>接入指南</h1>
            <p className={styles.lead}>
              接入这件事其实只有两个动作：把「地址」填到软件的 API 地址框，把「密钥」填到 API Key
              框。剩下的就是选对模型名。下面先给三个值，再给四步流程，最后是各个软件的点法。
            </p>
          </header>

          {/* 三个值：小白最先要拿到的就是这三样 */}
          <section className={styles.values}>
            {VALUES.map((item) => (
              <div key={item.title} className={styles.valueCard}>
                <h3>{item.title}</h3>
                <p>{item.tip}</p>
                <code className={styles.valueText}>{item.value}</code>
                {item.value.startsWith('http') && (
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ padding: 0, marginTop: 8 }}
                    onClick={() => void copy(item.value)}
                  >
                    复制
                  </Button>
                )}
              </div>
            ))}
          </section>

          {/* 四步流程：所有软件都一样，先建立这个心理模型 */}
          <section className={styles.flow}>
            {FLOW.map((step) => (
              <div key={step.no} className={styles.flowStep}>
                <IconBadge icon={<span style={{ fontSize: 14, fontWeight: 600 }}>{step.no}</span>} size="md" tone={step.no === 1 ? 'brand' : step.no === 2 ? 'amber' : step.no === 3 ? 'violet' : 'mint'} />
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            ))}
          </section>

          <PillTabs
            ariaLabel="接入指南"
            value={tab}
            onChange={switchTab}
            items={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          />

          {tab === 'client' && <SettingsMock />}
          {tab === 'start' ? <DocsPanel /> : tab === 'client' ? <AgentPanel /> : <SoftwarePanel />}
        </div>
      </Layout>
    </div>
  )
}

export default GuidePage
