import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ApiOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  CopyOutlined,
  KeyOutlined,
  LinkOutlined,
  RobotOutlined,
  SwapOutlined
} from '@ant-design/icons'
import { Alert, Button, message } from 'antd'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import { userStore } from '@/store'
import { copyToClipboard } from '@/utils'
import { getUserPricing, listUserApiKeys, type UserApiKeyItem } from '@/request/api'
import { pickFeaturedModelIds } from '@/data/modelPricing'
import { CC_HAHA_RELEASES, RELAY_HOST, RELAY_URL } from '@/utils/relay'
import { readPhone, readUserId, syncCredential } from '@/utils/llmCredential'
import PillTabs from '@/components/PillTabs'
import { GuideContent } from '@/pages/guide'
import { FORMAT_LABELS, FORMAT_OPTIONS } from '@/pages/guide/models'
import ApiKeyPanel from './ApiKeyPanel'
import styles from './index.module.less'

/**
 * 接入页（/agent，2026-10-24 从接入指南里独立出来）
 * ------------------------------------------------------------
 * 为什么独立：客户为了找「接口地址」和「密钥」这两个值，在 4 步教程里翻了半天，
 * 群里原话是「找了半天」「结果在教程里面找到」「不醒目」。
 * 所以这一页只干一件事：**打开就能看见那两个值，并且一键复制**。
 *
 * 和 /guide 的分工：
 *   /agent  = 拿值 + 知道填在哪（本页，第一屏就是地址和密钥）
 *   /guide  = 完整分步教程（怎么装软件、每个框填什么、报错怎么查）
 * 两页不重复讲同一段教程，底部互相引导。
 *
 * 复用说明：结构参考 git 历史里的第一版（_ref_agent_v1_original.tsx），
 * 但把「密钥在第 1 步操作区里、要先生成才看得到」改成「置顶复制面板先摆出值」，
 * 并且去掉了和教程重复的大段「对着软件点」步骤，只保留下方「填哪几个框」对照表。
 */

/** 密钥在列表里只显示打码版，复制时才给全文（和接入指南同一套写法） */
function maskKey(key: string) {
  if (!key) return ''
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}

/** 复制按钮：自己管「已复制」状态，点了立刻变成勾，给用户明确的成功反馈 */
function CopyButton({
  text,
  label = '复制',
  primary = false,
  block = false,
  disabled
}: {
  text: string
  label?: string
  primary?: boolean
  block?: boolean
  disabled?: boolean
}) {
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
      type={primary ? 'primary' : 'default'}
      block={block}
      disabled={disabled || !text}
      icon={copied ? <CheckOutlined /> : <CopyOutlined />}
      onClick={() => void onCopy()}
    >
      {copied ? '已复制' : label}
    </Button>
  )
}

/**
 * 一个「标签 + 等宽值 + 复制按钮」的横向复制行（地址、密钥、模型名共用）
 * ------------------------------------------------------------
 * 2026-10-25 加可选 format：站长反馈「拿到地址去 CC-Haha，还是不知道格式选哪个」。
 * 格式不能只写在下方的对照表里 —— 用户复制地址时眼睛在这一行，
 * 对应关系必须**就在地址旁边**，不用跳页、不用记。
 * 所以 format 是药丸原文（与下拉逐字一致），question 是一句带过的大白话。
 */
function CopyRow({
  title,
  hint,
  value,
  copyLabel,
  mono = true,
  primary = false,
  format,
  formatNote
}: {
  title: string
  hint?: string
  value: string
  copyLabel?: string
  mono?: boolean
  primary?: boolean
  format?: string
  formatNote?: string
}) {
  return (
    <div className={styles.copyRow}>
      <div className={styles.copyMeta}>
        <strong>{title}</strong>
        {hint ? <em>{hint}</em> : null}
        {format ? (
          <span className={styles.formatTagRow}>
            <span className={styles.formatTagLabel}>API 格式选</span>
            <span className={styles.formatTag} title={format}>
              {format}
            </span>
            {formatNote ? <span className={styles.formatTagNote}>{formatNote}</span> : null}
          </span>
        ) : null}
      </div>
      <div className={styles.copyValue}>
        <code className={mono ? styles.mono : undefined}>{value}</code>
        <CopyButton text={value} label={copyLabel || '复制'} primary={primary} />
      </div>
    </div>
  )
}

function pickClaudeModel(ids: string[]) {
  return ids.find((id) => /claude/i.test(id)) || 'claude-sonnet-5'
}

function pickGptModel(ids: string[]) {
  return ids.find((id) => /^gpt-/i.test(id) && !/image/i.test(id)) || ids[0] || 'gpt-6.1-sol'
}

function AgentPage() {
  /**
   * 页内两个页签（2026-10-25 站长要求把「接入教程」并进来）
   * ------------------------------------------------------------
   * 站长原话：「把这个接入教程并入现在的左侧这个接入导航栏中的这个按钮，
   * 然后这个接入要改成叫 agent 接入……页签里面应该有两个小页签，
   * 一个是地址密钥，还有一个是接入教程。已经点这个 agent 接入，默认的是这个地址密钥。」
   *
   * 取值：tab=values（默认，地址密钥） / tab=guide（接入教程）
   * 为什么用 ?tab= 记在 URL 上而不是纯 state：
   *   刷新、从教程里点「去拿密钥」、把链接发给别人，都能落到同一个页签。
   * 教程正文**直接复用** guide 页导出的 GuideContent 组件，
   * 不复制一份代码（否则以后改教程要改两处，必然漏）。
   */
  const [searchParams, setSearchParams] = useSearchParams()
  const agentTab = searchParams.get('tab') === 'guide' ? 'guide' : 'values'
  const switchAgentTab = (next: string) => {
    const nextParams = new URLSearchParams(searchParams)
    if (next === 'values') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setSearchParams(nextParams, { replace: true })
  }
  const { token, user_info, llm_api_key } = userStore()
  const [apiKey, setApiKey] = useState(llm_api_key || '')
  const [chatModels, setChatModels] = useState<string[]>([])
  // 密钥列表里能拿到完整密钥；首屏要直接显示值，不能等用户点开「管理密钥」
  const [keys, setKeys] = useState<UserApiKeyItem[]>([])

  const userId = readUserId(user_info)
  const phone = readPhone(user_info)

  useEffect(() => {
    if (llm_api_key) setApiKey(llm_api_key)
  }, [llm_api_key])

  /**
   * 首屏主动拉一次密钥列表
   * ------------------------------------------------------------
   * llm_api_key 只存在内存里，刷新页面就没了（见 store/user/slice.ts）。
   * 如果只依赖 store，用户一刷新本页就会看到「还没有密钥」，等于又要去找。
   * 所以这里跟 ApiKeyPanel 一样读一次列表，并用 syncCredential 自动选中一把可用的。
   */
  const loadKeys = useCallback(async () => {
    if (!token) {
      setKeys([])
      return
    }
    try {
      const res: any = await listUserApiKeys()
      const payload = res?.data || {}
      if (String(payload.code) !== '0') return
      const list = (payload.keys || []) as UserApiKeyItem[]
      setKeys(list)
      const next = syncCredential(user_info, Boolean(payload.allow_phone_key), list)
      if (next) {
        setApiKey(next)
        userStore.getState().setLlmAccess({ llm_api_key: next })
      }
    } catch {
      // 拉不到就退回 store 里的值，不打断页面（未登录时 token 为空，本来就走不到这里）
    }
  }, [token, user_info])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  useEffect(() => {
    if (!token) {
      setChatModels([])
      return
    }
    const controller = new AbortController()
    getUserPricing({ signal: controller.signal })
      .then((data) => {
        const ids = Array.from(
          new Set([...(data.model_ids || []), ...(data.models || []).map((item) => item.model).filter(Boolean)])
        )
        setChatModels(pickFeaturedModelIds(ids, 4))
      })
      .catch(() => setChatModels([]))
    return () => controller.abort()
  }, [token])

  const key = apiKey.trim()
  const usingPhone = /^1[3-9]\d{9}$/.test(key)
  const gptModel = useMemo(() => pickGptModel(chatModels), [chatModels])
  const claudeModel = useMemo(() => pickClaudeModel(chatModels), [chatModels])

  /**
   * 首屏密钥值的最终显示
   * ------------------------------------------------------------
   * 已登录且能读到密钥 → 打码显示（完整值靠按钮复制，避免在公共场合被偷看）
   * 已登录但还没有密钥 → 明确说「还没有」，并把「新建密钥」做成主按钮
   * 未登录 → 引导登录，不显示空白
   */
  const keyDisplay = !key ? '还没有可用密钥' : maskKey(key)
  const activeKeys = keys.filter((item) => item.is_active).length

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          {/**
           * 页内两个页签（2026-10-25 站长要求）
           * ------------------------------------------------------------
           * 「地址密钥」默认选中 —— 站长原话：「已经点这个 agent 接入，默认的是这个地址密钥。
           * 不明白的人可以点接入教程。」
           * 用现成的 PillTabs（变体 solid：白底槽 + 品牌色选中态），
           * 和充值商城、公告页同一套组件，视觉天然统一，也让「这俩能点」一眼可见。
           */}
          <PillTabs
            ariaLabel="Agent 接入"
            variant="solid"
            value={agentTab}
            onChange={switchAgentTab}
            items={[
              { key: 'values', label: '地址密钥' },
              { key: 'guide', label: '接入教程' }
            ]}
          />

          {agentTab === 'guide' ? (
            /* 教程页签：正文复用 guide 页的 GuideContent，不复制代码 */
            <div className={styles.guidePane}>
              <GuideContent />
            </div>
          ) : (
          <>
          {/* ---------- 页面头：只说这一页是干什么的，教程留给接入指南 ---------- */}
          <header className={styles.hero}>
            <div className={styles.heroMain}>
              <p className={styles.kicker}>接入</p>
              <h1>接口地址和密钥，都在这一页</h1>
              <p className={styles.lead}>
                下面两个值复制走，填进你在用的软件就能用。不知道往哪填，底部有一步步的图文教程。
              </p>
            </div>
            <div className={styles.heroAside}>
              <Link to="/guide" className={styles.heroLink}>
                看完整教程
                <ArrowRightOutlined />
              </Link>
            </div>
          </header>

          {/* ---------- 第一屏核心：地址 + 密钥（本次需求的全部重点） ---------- */}
          <section className={styles.keyCard} aria-labelledby="agent-values">
            <div className={styles.cardHead}>
              <IconBadge icon={<ApiOutlined />} tone="brand" size="lg" />
              <div>
                <h2 id="agent-values">复制这两个值</h2>
                <p>地址是本站的，密钥是你账号的。一个地址、一把密钥，所有软件通用。</p>
              </div>
            </div>

            <div className={styles.valueGroup}>
              {/**
               * 两条地址各自挂上「API 格式选什么」（2026-10-25 站长需求）
               * ------------------------------------------------------------
               * hint 只保留「谁用这条」，格式统一交给下面的药丸，避免一行里堆两句话。
               * 药丸原文来自 FORMAT_LABELS，与 CC-Haha 下拉逐字一致，用户能直接对上。
               */}
              <CopyRow
                title="接口地址"
                hint="Codex、Cursor、ChatBox 等填这条"
                value={RELAY_URL}
                copyLabel="复制地址"
                primary
                format={FORMAT_LABELS.responses}
                formatNote="GPT / Gemini / DeepSeek 等（除 Claude）"
              />
              <CopyRow
                title="Claude 专用地址"
                hint="只有模型名是 claude- 开头的才用这条"
                value={RELAY_HOST}
                copyLabel="复制地址"
                format={FORMAT_LABELS.anthropic}
                formatNote="Claude 全系"
              />
            </div>

            <div className={styles.valueGroup}>
              <div className={styles.keyBlock}>
                <div className={styles.copyMeta}>
                  <strong>API 密钥</strong>
                  <em>
                    {usingPhone
                      ? '旧账号仍可填手机号；新账号请用 sk- 开头的密钥'
                      : '填 sk- 开头的本站密钥，不是 OpenAI 官方 Key'}
                  </em>
                </div>
                {!token ? (
                  /* 未登录：给引导，不留白 */
                  <div className={styles.keyEmpty}>
                    <p>密钥在登录后生成，一个账号可以建多把，一把用在所有软件里。</p>
                    <Button type="primary" onClick={() => userStore.getState().setLoginModal(true)}>
                      登录 / 注册后拿密钥
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className={styles.copyValue}>
                      <code
                        className={[styles.mono, key ? '' : styles.monoEmpty].filter(Boolean).join(' ')}
                        title={key ? '完整密钥请点右边的复制按钮' : undefined}
                      >
                        {keyDisplay}
                      </code>
                      {key ? (
                        <CopyButton text={key} label="复制密钥" primary />
                      ) : (
                        <Button
                          type="primary"
                          onClick={() => {
                            const node = document.getElementById('agent-key-manage')
                            node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }}
                        >
                          去生成密钥
                        </Button>
                      )}
                    </div>
                    <p className={styles.keyFoot}>
                      {key
                        ? activeKeys > 1
                          ? `你还有 ${activeKeys - 1} 把可用密钥，可在下方「管理密钥」里切换。`
                          : '换电脑或担心泄露，可以在下方新建一把，旧的禁用即可。'
                        : '点「去生成密钥」→ 填个备注（比如「家里电脑」）→ 点「生成密钥」，之后回这里复制。'}
                    </p>
                  </>
                )}
              </div>

              <CopyRow
                title="模型名"
                hint="随便填一个先用起来，之后可在价目页换。gpt- 开头用于写代码"
                value={gptModel || 'gpt-6.1-sol'}
              />
              <CopyRow
                title="Claude 模型名"
                hint="只有用 Anthropic 格式时才填这条"
                value={claudeModel}
              />
            </div>
          </section>

          {/* ---------- API 格式怎么选（2026-10-25 站长需求） ----------
           * 站长原话：用户拿着图 1 的两条地址去图 2 的「添加模型」弹窗，
           * 看到「API 格式」下拉（a/b/c 三项）就卡住了 —— 页面从头到尾没提过这个下拉。
           * 所以这里补一块「格式三分支对照」，只解释「格式这一步」，
           * 不写软件怎么装、一步步点哪里（那是 ?tab=guide 教程页的事）。
           *
           * 数据源：FORMAT_OPTIONS（guide/models.ts），和 /guide 共用同一份字面值，
           * 以后站长改下拉文案只改一处，两页一起跟着变。
           */}
          <section className={styles.card} aria-labelledby="agent-format">
            <div className={styles.cardHead}>
              <IconBadge icon={<SwapOutlined />} tone="violet" size="lg" />
              <div>
                <h2 id="agent-format">API 格式怎么选</h2>
                <p>
                  CC-Haha「添加模型」里有个「API 格式」下拉。这一步选错，地址填得再对也连不上。
                </p>
              </div>
            </div>

            {/* 生活化类比：先说清「格式」到底是个什么东西，再讲选哪个 */}
            <p className={styles.formatLead}>
              打个比方：地址是门牌号，格式是进门后要说的暗号。门牌找对了、暗号说错了，门照样不开。
              下面三行就是三个暗号，照着你的模型名挑一行即可。
            </p>

            <div className={styles.formatList}>
              {FORMAT_OPTIONS.map((opt) => {
                const pickable = opt.tone === 'pick'
                return (
                  <article
                    key={opt.key}
                    className={[styles.formatItem, pickable ? styles.formatItemPick : styles.formatItemAvoid]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <IconBadge
                      icon={pickable ? <CheckOutlined /> : <SwapOutlined />}
                      tone={pickable ? 'brand' : 'amber'}
                      size="md"
                    />
                    <div className={styles.formatMain}>
                      <div className={styles.formatTitle}>
                        <span className={styles.formatLetter}>{opt.letter}</span>
                        <strong>{opt.label}</strong>
                        <span className={pickable ? styles.formatBadgePick : styles.formatBadgeAvoid}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className={styles.formatScope}>{opt.scope}</p>
                      <div className={styles.formatAddr}>
                        <span className={styles.formatAddrLabel}>地址配这条</span>
                        <code className={styles.mono} title={opt.baseUrl}>
                          {opt.baseUrl}
                        </code>
                        <span className={styles.formatAddrNote}>{opt.baseUrlNote}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <p className={styles.formatFoot}>
              一句话记：<b>名字带 claude 选 a</b>，<b>其它一律选 c</b>。b 是老格式，新模型的新功能到它那儿容易打折扣，
              所以不推荐；但个别老软件只认 b，真遇到了也能用，地址同样带 /v1。
            </p>
          </section>

          {/* ---------- 第二屏：知道填在哪（简版对照，不重复教程） ---------- */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <IconBadge icon={<RobotOutlined />} tone="violet" size="lg" />
              <div>
                <h2>软件里填哪几个框</h2>
                <p>不同软件名字不一样，认这三个位置就够了。</p>
              </div>
            </div>
            <div className={styles.memory}>
              <article>
                <strong>gpt- 开头</strong>
                <span>写代码</span>
                <code>地址填带 /v1 的那条</code>
                {/* 2026-10-25：原来写「OpenAI 格式」，下拉里没有这个词，统一成实际要选的项 */}
                <small>格式选 c) Responses，绝大多数软件用这套</small>
              </article>
              <article>
                <strong>claude- 开头</strong>
                <span>写代码</span>
                <code>地址填不带 /v1 的那条</code>
                <small>格式选 a) Anthropic Messages，Claude-haha 默认走这套</small>
              </article>
              <article>
                <strong>gpt-image- 开头</strong>
                <span>画图</span>
                <code>和 GPT 共用同一条地址</code>
                <small>只换图片模型，别填进「主模型」</small>
              </article>
            </div>
            <div className={styles.guideCta}>
              <p>不知道具体填在哪、或者报错了？</p>
              <Link to="/guide">
                <Button type="primary" size="large">
                  看接入指南（分步图文）
                  <ArrowRightOutlined />
                </Button>
              </Link>
            </div>
          </section>

          {/* ---------- 密钥管理：新建 / 禁用 / 删除。默认折叠，避免抢走首屏注意力 ---------- */}
          <section id="agent-key-manage" className={styles.card}>
            <div className={styles.cardHead}>
              <IconBadge icon={<KeyOutlined />} tone="amber" size="lg" />
              <div>
                <h2>管理密钥</h2>
                <p>新建、禁用、删除都在这里。禁用后可再启用，删除则立即失效。</p>
              </div>
            </div>
            <ApiKeyPanel embedded onKeyChange={setApiKey} />
          </section>

          {/* ---------- 推荐客户端：只给入口，具体怎么装看教程 ---------- */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <IconBadge icon={<LinkOutlined />} tone="brand" size="lg" />
              <div>
                <h2>还没有客户端？</h2>
                <p>推荐 Claude-haha：带窗口的桌面软件，写代码和画图都能做，免费。</p>
              </div>
            </div>
            <div className={styles.linkLine}>
              <a href={CC_HAHA_RELEASES} target="_blank" rel="noreferrer">
                {CC_HAHA_RELEASES}
              </a>
              <CopyButton text={CC_HAHA_RELEASES} label="复制下载页" />
            </div>
            {!token ? (
              <Alert
                showIcon
                type="info"
                style={{ marginTop: 12 }}
                message="先登录才能生成密钥"
                description="地址可以先复制；密钥需要登录后在「管理密钥」里生成。"
              />
            ) : null}
          </section>
          </>
          )}
        </div>
      </Layout>
    </div>
  )
}

export default AgentPage
