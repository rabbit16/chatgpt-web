import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Tag, message } from 'antd'
import { CheckOutlined, CopyOutlined } from '@ant-design/icons'
import { userStore } from '@/store'
import { copyToClipboard } from '@/utils'
import { getUserPricing } from '@/request/api'
import { pickFeaturedModelIds } from '@/data/modelPricing'
import ApiKeyPanel from './ApiKeyPanel'
import styles from './index.module.less'

export const RELAY_HOST = (import.meta.env.VITE_APP_REQUEST_HOST || '').replace(/\/apiAI\/?$/, '')
export const RELAY_URL = `${RELAY_HOST}/v1`
export const CC_HAHA_RELEASES = 'https://github.com/NanmiCoder/cc-haha/releases'

type AppId = 'haha' | 'codex' | 'cursor' | 'other'
type JobId = 'code-gpt' | 'code-claude' | 'draw'

type FillRow = {
  label: string
  value: string
  tip: string
}

function pickClaudeModel(ids: string[]) {
  return ids.find((id) => /claude/i.test(id)) || 'claude-sonnet-5'
}

function pickGptModel(ids: string[]) {
  return ids.find((id) => /^gpt-/i.test(id) && !/image/i.test(id)) || ids[0] || 'gpt-6.1-sol'
}

function pickImageModel(ids: string[]) {
  return (
    ids.find((id) => /gpt-image-2\.5-sunburst/i.test(id)) ||
    ids.find((id) => /gpt-image-2$/i.test(id)) ||
    ids.find((id) => /image/i.test(id)) ||
    'gpt-image-2'
  )
}

function CopyButton({ text, disabled, label = '复制' }: { text: string; disabled?: boolean; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    if (!text || disabled) return
    try {
      await copyToClipboard(text)
      setCopied(true)
      message.success('已复制，去软件里粘贴即可')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      message.error('复制失败，请用鼠标选中后按 Ctrl+C')
    }
  }

  return (
    <Button
      type="primary"
      disabled={disabled || !text}
      icon={copied ? <CheckOutlined /> : <CopyOutlined />}
      onClick={() => void onCopy()}
    >
      {copied ? '已复制' : label}
    </Button>
  )
}

function FillCard({ rows, title }: { rows: FillRow[]; title?: string }) {
  return (
    <div className={styles.fillCard}>
      {title ? <h3>{title}</h3> : null}
      <p className={styles.fillLead}>打开软件对应的输入框，把右边的内容粘进去。一行对一个框。</p>
      <ol className={styles.fillList}>
        {rows.map((row) => (
          <li key={row.label}>
            <div className={styles.fillMeta}>
              <span className={styles.fillLabel}>软件里这个框</span>
              <strong>{row.label}</strong>
              <em>{row.tip}</em>
            </div>
            <div className={styles.fillValue}>
              <code>{row.value}</code>
              <CopyButton text={row.value} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function AgentPanel() {
  const { token, llm_api_key } = userStore()
  const [apiKey, setApiKey] = useState(llm_api_key || '')
  const [appId, setAppId] = useState<AppId>('haha')
  const [jobId, setJobId] = useState<JobId>('code-gpt')
  const [chatModels, setChatModels] = useState<string[]>([])
  const [imageModels, setImageModels] = useState<string[]>([])
  const [showMoreApps, setShowMoreApps] = useState(false)

  useEffect(() => {
    if (llm_api_key) setApiKey(llm_api_key)
  }, [llm_api_key])

  useEffect(() => {
    if (!token) {
      setChatModels([])
      setImageModels([])
      return
    }
    const controller = new AbortController()
    getUserPricing({ signal: controller.signal })
      .then((data) => {
        const ids = Array.from(
          new Set([...(data.model_ids || []), ...(data.models || []).map((item) => item.model).filter(Boolean)])
        )
        setChatModels(pickFeaturedModelIds(ids, 4))
        setImageModels(Array.from(new Set((data.image_models || []).map((item) => item.model).filter(Boolean))))
      })
      .catch(() => {
        setChatModels([])
        setImageModels([])
      })
    return () => controller.abort()
  }, [token])

  const key = apiKey.trim() || '先在上面生成并选中一把密钥'
  const usingPhone = /^1[3-9]\d{9}$/.test(key)
  const keyTip = usingPhone ? '旧账号仍可填手机号' : '填 sk- 开头的本站密钥，不是官方 Key'
  const gptModel = pickGptModel(chatModels)
  const claudeModel = pickClaudeModel(chatModels)
  const imageModel = pickImageModel(imageModels)

  const hahaGptRows: FillRow[] = [
    { label: '预设', value: 'Custom', tip: '选「自定义 / Custom」，不要点官方 Claude 登录' },
    { label: '名称', value: 'RabbitJ', tip: '随便起，方便你认出是本站' },
    { label: '接口地址', value: RELAY_URL, tip: '必须带 /v1，少写或多写都会连不上' },
    { label: 'API 格式', value: 'OpenAI Chat Completions', tip: 'Claude-haha 支持 OpenAI 协议，写代码和画图都走这一条' },
    { label: '认证方式', value: 'Bearer Token', tip: '下拉选这一项即可' },
    { label: 'API 密钥', value: key, tip: keyTip },
    { label: '主模型', value: gptModel, tip: '写代码用 GPT。可在价目页换别的 gpt- 开头名字' }
  ]

  const hahaClaudeRows: FillRow[] = [
    { label: '预设', value: 'Custom', tip: '选自定义，不要用官方账号登录' },
    { label: '名称', value: 'RabbitJ-Claude', tip: '和上面 GPT 那条分开，避免填混' },
    { label: '接口地址', value: RELAY_HOST, tip: 'Claude 模型这条不要加 /v1' },
    { label: 'API 格式', value: 'Anthropic Messages', tip: '只有要用 Claude 模型时才选这个' },
    { label: '认证方式', value: 'Bearer Token', tip: '下拉选这一项' },
    { label: 'API 密钥', value: key, tip: keyTip },
    { label: '主模型', value: claudeModel, tip: '只填 claude- 开头的名字' }
  ]

  const hahaDrawRows: FillRow[] = [
    { label: '先按「写代码」配好一条 OpenAI', value: RELAY_URL, tip: '画图挂在同一条服务商上，不用再装软件' },
    { label: 'API 密钥', value: key, tip: keyTip },
    { label: '图片模型', value: imageModel, tip: '只填 gpt-image- 开头的名字，不要填进「主模型」' }
  ]

  const codexRows: FillRow[] = [
    { label: 'API Key / 密钥', value: key, tip: keyTip },
    { label: 'Base URL / 接口地址', value: RELAY_URL, tip: '必须带 /v1' },
    { label: '模型', value: gptModel, tip: '填 gpt- 开头，不要填 claude 或 image' }
  ]

  const cursorRows: FillRow[] = [
    { label: 'OpenAI API Key', value: key, tip: keyTip },
    { label: 'Override OpenAI Base URL', value: RELAY_URL, tip: '带 /v1' },
    { label: 'Model', value: gptModel, tip: 'gpt- 开头的对话模型' }
  ]

  const clineRows: FillRow[] = [
    { label: 'API Provider', value: 'OpenAI Compatible', tip: '先选这一项' },
    { label: 'Base URL', value: RELAY_URL, tip: '带 /v1，不要再加 /chat/completions' },
    { label: 'API Key', value: key, tip: keyTip },
    { label: 'Model ID', value: gptModel, tip: 'gpt- 开头' }
  ]

  const job = useMemo(() => {
    if (jobId === 'draw') {
      return {
        title: '我要画图',
        why: '画图走本站的图片接口。Claude-haha 里用刚才那条 OpenAI 服务商，聊天里直接说「画一张……」。',
        warn: '不要把图片模型填进「主模型」。主模型管写代码，图片模型管出图。'
      }
    }
    if (jobId === 'code-claude') {
      return {
        title: '我要用 Claude 写代码',
        why: 'Claude 模型用另一套填写方式：接口地址不带 /v1，格式选 Anthropic。和 GPT 那条不要填在同一个框里。',
        warn: 'Claude-haha 也能走 OpenAI。如果你只用 GPT，选上面「写代码（推荐）」更简单。'
      }
    }
    return {
      title: '我要写代码（推荐）',
      why: 'Claude-haha 已支持 OpenAI 协议，一条配置就能写代码。小白请走这一条。',
      warn: '接口地址一定要带 /v1。密钥填上面选中的 sk- 密钥。'
    }
  }, [jobId])

  const fillRows = (() => {
    if (appId === 'haha') {
      if (jobId === 'draw') return hahaDrawRows
      if (jobId === 'code-claude') return hahaClaudeRows
      return hahaGptRows
    }
    if (appId === 'codex' || appId === 'cursor' || appId === 'other') {
      if (jobId !== 'code-gpt') return []
      if (appId === 'codex') return codexRows
      if (appId === 'cursor') return cursorRows
      return clineRows
    }
    return []
  })()

  const clickSteps = useMemo(() => {
    if (appId === 'haha') {
      const common = [
        { n: 1, t: '下载并打开 Claude-haha', d: '去 GitHub Releases 下载电脑版（Windows / Mac / Linux），安装后打开。' },
        { n: 2, t: '点左下角「设置」', d: '再点左边第一项「服务商」。' },
        { n: 3, t: '点「添加服务商」', d: '预设选 Custom（自定义）。' }
      ]
      if (jobId === 'draw') {
        return [
          ...common.slice(0, 2),
          {
            n: 3,
            t: '打开你已经加好的 RabbitJ（OpenAI 那条）',
            d: '没有的话先按「写代码（推荐）」加一条。画图不用再新建 Claude。'
          },
          { n: 4, t: '找到图片 / Images 相关框', d: `图片模型填 ${imageModel}。密钥用第 1 步选中的那一把。` },
          { n: 5, t: '回到聊天，直接说「画一张……」', d: '生成后请自己保存图片。本站数据库不存图。' }
        ]
      }
      return [
        ...common,
        { n: 4, t: '对照下面表格，一个框填一行', d: '填完点「添加」，再点「测试」，通过后点「设为默认」。' },
        { n: 5, t: '新建一个会话，右下角选模型', d: '发一句「帮我新建一个 hello.txt 并写上 hello」试一下。' }
      ]
    }
    if (appId === 'codex') {
      return [
        { n: 1, t: '打开 Codex', d: '安装好官方 Codex 后打开它的设置 / 服务商页面。' },
        { n: 2, t: '新建或编辑一个服务商', d: '类型选 OpenAI 兼容。' },
        { n: 3, t: '对照下面三行填写', d: '密钥用第 1 步选中的 sk- 密钥，地址必须带 /v1，模型用 gpt- 开头。' },
        { n: 4, t: '保存后新开一次对话', d: 'Codex 不会画图。要画图请用本站「绘图」或 Claude-haha。' }
      ]
    }
    if (appId === 'cursor') {
      return [
        { n: 1, t: '打开 Cursor 设置 → Models', d: '找到 OpenAI API Key 和 Override OpenAI Base URL。' },
        { n: 2, t: '按下面三行填写', d: '不要同时开 Cursor 自己的官方账号，否则请求不会走本站。' },
        { n: 3, t: '保存后重启 Cursor，新开对话', d: '模型填 gpt- 开头。' }
      ]
    }
    return [
      { n: 1, t: '打开 Cline / Continue / Roo', d: '服务商选 OpenAI Compatible。' },
      { n: 2, t: '按下面几行填写', d: '地址带 /v1，密钥用第 1 步选中的 sk- 密钥。' }
    ]
  }, [appId, jobId, imageModel])

  const mismatch =
    (appId === 'codex' && jobId !== 'code-gpt') ||
    (appId === 'cursor' && jobId !== 'code-gpt') ||
    (appId === 'other' && jobId !== 'code-gpt')

  return (
    <div className={styles.wrapPanel}>
          <ApiKeyPanel onKeyChange={setApiKey} />

          <section className={styles.card}>
            <div className={styles.stepHead}>
              <span>第 2 步</span>
              <h2>先选软件，再选用途</h2>
            </div>
            <p>
              两个问题：<b>你电脑上装的是哪个软件</b>、<b>你想让它干什么</b>。下面先选软件；选完后一组按钮就是用途。
              不确定选哪个就用第一个——Claude-haha 是带窗口的桌面软件，写代码和画图都能做。
            </p>
            <div className={styles.choiceGrid}>
              <button
                className={appId === 'haha' ? styles.choiceActive : styles.choice}
                onClick={() => setAppId('haha')}
              >
                <Tag color="blue">推荐</Tag>
                <strong>Claude-haha（推荐）</strong>
                <span>桌面客户端，安装即用；兼容 OpenAI 协议，代码与绘图共用一套配置。</span>
              </button>
              <button
                className={appId === 'codex' ? styles.choiceActive : styles.choice}
                onClick={() => setAppId('codex')}
              >
                <strong>Codex</strong>
                <span>面向编程的客户端，仅需填写三项：API Key、API 地址与 GPT 模型名。</span>
              </button>
              <button
                className={appId === 'cursor' ? styles.choiceActive : styles.choice}
                onClick={() => setAppId('cursor')}
              >
                <strong>Cursor</strong>
                <span>代码编辑器，在设置中将 OpenAI Base URL 替换为本站地址。</span>
              </button>
            </div>
            <Button type="link" onClick={() => setShowMoreApps((v) => !v)}>
              {showMoreApps ? '收起其他软件' : '我用的是 Cline / Continue / 官方 Claude Code'}
            </Button>
            {showMoreApps ? (
              <div className={styles.moreApps}>
                <button
                  className={appId === 'other' ? styles.choiceActive : styles.choice}
                  onClick={() => setAppId('other')}
                >
                  <strong>Cline / Continue / Roo</strong>
                  <span>选 OpenAI Compatible，按下面表格填。</span>
                </button>
                <Alert
                  showIcon
                  type="info"
                  message="官方 Claude Code 要用命令行，不适合第一次。"
                  description="想用 Claude 模型，请直接装 Claude-haha，在软件里选「Anthropic」格式即可，不用 export。"
                />
              </div>
            ) : null}
            {appId === 'haha' ? (
              <p className={styles.linkLine}>
                下载地址：
                <a href={CC_HAHA_RELEASES} target="_blank" rel="noreferrer">
                  {CC_HAHA_RELEASES}
                </a>
                <CopyButton text={CC_HAHA_RELEASES} label="复制下载页" />
              </p>
            ) : null}
          </section>

          <section className={styles.card}>
            <div className={styles.stepHead}>
              <span>还是第 2 步</span>
              <h2>你想让它干什么</h2>
            </div>
            <p>同一个软件，想干的事不同，要填的模型名也不同。选一个用途，下面会给出对应的填法。</p>
            <div className={styles.jobRow}>
              <button
                className={jobId === 'code-gpt' ? styles.jobActive : styles.job}
                onClick={() => setJobId('code-gpt')}
              >
                写代码（推荐）
              </button>
              <button
                className={jobId === 'draw' ? styles.jobActive : styles.job}
                onClick={() => setJobId('draw')}
              >
                画图
              </button>
              <button
                className={jobId === 'code-claude' ? styles.jobActive : styles.job}
                onClick={() => setJobId('code-claude')}
              >
                用 Claude 模型
              </button>
            </div>
            <Alert showIcon type="info" message={job.title} description={job.why} />
            {mismatch ? (
              <Alert
                showIcon
                type="warning"
                style={{ marginTop: 12 }}
                message="这个软件做不了这件事"
                description={
                  jobId === 'draw'
                    ? 'Codex / Cursor 不负责画图。请改用 Claude-haha，或打开本站左侧「绘图」。'
                    : 'Codex / Cursor 请用 GPT 模型。要用 Claude，请改选 Claude-haha。'
                }
              />
            ) : null}
          </section>

          {!mismatch ? (
            <section className={styles.card}>
              <div className={styles.stepHead}>
                <span>第 3 步</span>
                <h2>照着这张卡填两个框，再用第 4 步选模型</h2>
              </div>
              <p className={styles.cardLead}>
                软件设置里通常只有两个空白要你操心：<b>API 地址</b>（填下面这行）和 <b>API Key</b>（填第 1 步生成的那串）。
                其它开关保持默认即可。
              </p>
              <ol className={styles.clickSteps}>
                {clickSteps.map((item) => (
                  <li key={item.n}>
                    <i>{item.n}</i>
                    <div>
                      <strong>{item.t}</strong>
                      <p>{item.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <FillCard rows={fillRows} />
              <p className={styles.warnLine}>{job.warn}</p>
              {appId === 'haha' && jobId === 'draw' ? (
                <div className={styles.drawNote}>
                  <h3>在 Claude-haha 里怎么画出图</h3>
                  <ol>
                    <li>先按「写代码（推荐）」加好 RabbitJ（OpenAI，地址带 /v1）。</li>
                    <li>同一条服务商里填图片模型 {imageModel}。</li>
                    <li>新建聊天，输入「画一张坐在窗边的橘猫，写实」。等图片出来后立刻下载保存。</li>
                    <li>不要把 gpt-image- 填进「主模型」，否则写代码和画图都会乱。</li>
                  </ol>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className={styles.card}>
            <h2>第 4 步：模型名怎么选</h2>
            <p>
              不同软件的"模型"输入框长得不一样，但判断方法只有一条：
              <b>看模型名的前缀</b>。前缀决定它属于哪一家、走哪种协议。
            </p>
            <div className={styles.memory}>
              <article>
                <strong>gpt- 开头</strong>
                <span>写代码</span>
                <code>{RELAY_URL}</code>
                <small>OpenAI 格式，地址带 /v1</small>
              </article>
              <article>
                <strong>claude- 开头</strong>
                <span>写代码</span>
                <code>{RELAY_HOST}</code>
                <small>Anthropic 格式，地址不带 /v1</small>
              </article>
              <article>
                <strong>gpt-image- 开头</strong>
                <span>画图</span>
                <code>{RELAY_URL}</code>
                <small>跟 GPT 同一条，只换图片模型</small>
              </article>
            </div>
          </section>
    </div>
  )
}

