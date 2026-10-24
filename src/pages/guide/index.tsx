import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ApiOutlined,
  CheckCircleFilled,
  CopyOutlined,
  DownloadOutlined,
  KeyOutlined,
  LinkOutlined,
  MessageOutlined,
  PictureOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Button, Select, message } from 'antd'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import { DocsPanel } from '@/pages/docs'
// 2026-10-24：密钥管理已从教程页移到 /agent，这里不再需要 ApiKeyPanel
import { getSoftwareList, type SoftwareItem } from '@/request/api'
import { userStore } from '@/store'
import { copyToClipboard } from '@/utils'
import { CC_HAHA_RELEASES, RELAY_HOST, RELAY_URL } from '@/utils/relay'
import {
  defaultGuideModel,
  findModel,
  groupModels,
  guideModelSummary,
  protocolMeta,
  providerLabel,
  type GuideModel
} from './models'
import styles from './index.module.less'

/**
 * 接入指南（2026-10-22 重做）
 * ------------------------------------------------------------
 * 旧版把「首屏卡片」「各软件具体填法」「客户端下载」三套内容叠在一起，
 * 同一句话出现两遍，页面拉到 4600px 仍然不知道先看哪。
 * 现在只留一条主线，按用户真实顺序排：
 *   1 装客户端 → 2 复制地址与密钥 → 3 照着 Claude-haha 的「添加模型」窗口填 4 个框 → 4 发一句验证
 * 软件下载是第一步，用紧凑列表（一行一个，点到即下载），不再是大图卡片。
 * 其他客户端不逐一展开：同样三样值填进去即可，统一说「参照执行」。
 */

/** cc-haha 自带的图片生成走 OpenAI 兼容 Images，用本站的 gpt-image 模型 */
const IMAGE_MODEL = 'gpt-image-2'

/** 密钥在页面上只显示打码版，复制时才给全文 */
function maskKey(key: string) {
  if (!key) return ''
  if (key.length <= 14) return key
  return `${key.slice(0, 7)}…${key.slice(-4)}`
}

function useCopy() {
  return async (value: string, label: string) => {
    if (!value) {
      message.warning('先登录并生成一把密钥')
      return
    }
    try {
      await copyToClipboard(value)
      message.success(`已复制${label}`)
    } catch {
      message.warning('浏览器限制了自动复制，请手动选中复制')
    }
  }
}

/* ---------------- 第 1 步：客户端下载（紧凑列表） ---------------- */

function ClientDownloads() {
  const [items, setItems] = useState<SoftwareItem[]>([])
  const [loading, setLoading] = useState(true)
  const copy = useCopy()

  useEffect(() => {
    let alive = true
    getSoftwareList({ page: 1, page_num: 6 })
      .then((res: any) => {
        const list = (res?.data?.list || []) as SoftwareItem[]
        // 推荐款排前面：Claude-haha → Codex → 其他
        const weight = (name: string) => (/haha/i.test(name) ? 0 : /codex/i.test(name) ? 1 : 2)
        const sorted = [...list].sort(
          (a, b) => weight(a.name) - weight(b.name) || (a.sort ?? 0) - (b.sort ?? 0)
        )
        if (alive) setItems(sorted)
      })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  if (loading) return <p className={styles.loadingLine}>正在取下载列表…</p>

  if (items.length === 0) {
    return (
      <a className={styles.dlFallback} href={CC_HAHA_RELEASES} target="_blank" rel="noreferrer">
        <DownloadOutlined /> Claude-haha 下载页（GitHub Releases）
      </a>
    )
  }

  return (
    <ul className={styles.dlGrid}>
      {items.map((item) => {
        const first = item.links?.[0]
        return (
          <li key={item.id} className={styles.dlRow}>
            <div className={styles.dlMain}>
              {/haha/i.test(item.name) ? <span className={styles.dlRec}>推荐</span> : null}
              <strong>{item.name}</strong>
              <span className={styles.dlTag}>{item.version ? `v${item.version}` : '安装包'}</span>
            </div>
            <div className={styles.dlActions}>
              {(item.links || []).map((link, index) => (
                <a
                  key={`${link.url}-${index}`}
                  className={styles.dlBtn}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <DownloadOutlined /> {link.label || '下载'}
                </a>
              ))}
              {first?.code ? (
                <button
                  type="button"
                  className={styles.dlCode}
                  title="点击复制提取码"
                  onClick={() => void copy(first.code || '', '提取码')}
                >
                  提取码 {first.code}
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
      <li className={styles.dlMore}>
        <a href={CC_HAHA_RELEASES} target="_blank" rel="noreferrer">
          <LinkOutlined /> Claude-haha 也有 GitHub 直链
        </a>
      </li>
    </ul>
  )
}

/* ---------------- 第 3 步：Claude-haha 界面示意 ---------------- */

function HahaMock({ model }: { model: GuideModel }) {
  const meta = protocolMeta(model.provider)
  return (
    <div className={styles.mock} aria-label="Claude-haha 添加模型界面示意">
      <div className={styles.mockBar}>
        <strong>添加模型</strong>
        <span>Claude-haha 0.7.x</span>
      </div>
      <div className={styles.mockBody}>
        <div className={styles.mockRow}>
          <span className={styles.mockLabel}>预设</span>
          <div className={styles.mockChips}>
            <span>DeepSeek</span>
            <span>Kimi</span>
            <span>Ollama</span>
            <span className={styles.mockChipOn}>自定义模型 API</span>
          </div>
        </div>
        <MockField no={2} label="配置名称" value="RabbitJ" />
        <MockField no={3} label="接口地址" value={meta.baseUrl} mono />
        <MockField no={4} label="API 密钥" value="sk-••••••••••••" mono />
        <MockField no={5} label="主模型" value={model.id} mono />
        <div className={styles.mockDefault}>
          <span>模型映射</span>
          <em>{meta.mappingLabel}</em>
        </div>
        <div className={styles.mockDefault}>
          <span>下方默认项</span>
          <em>
            API 格式 <b>{meta.formatLabel}</b> · 认证变量 <b>{meta.authLabel}</b> · 其余不动
          </em>
        </div>
        <p className={styles.mockNote}>
          填完点<b>「获取模型」</b>可直接从列表里选，再点<b>「添加」</b>。
        </p>
        <div className={styles.mockActions}>
          <span className={styles.mockGhost}>取消</span>
          <span className={styles.mockPrimary}>添加</span>
        </div>
      </div>
    </div>
  )
}

function MockField({ no, label, value, mono }: { no: number; label: string; value: string; mono?: boolean }) {
  return (
    <div className={styles.mockField}>
      <span className={styles.mockLabel}>
        {label} <i>*</i>
      </span>
      <div className={mono ? `${styles.mockInput} ${styles.mockMono}` : styles.mockInput}>{value}</div>
      <span className={styles.mockMark}>{no}</span>
    </div>
  )
}

/* ---------------- 页面 ---------------- */

function GuidePage() {
  const [params] = useSearchParams()
  const { token, llm_api_key, setLoginModal } = userStore()
  const [key, setKey] = useState(llm_api_key || '')
  // 第 2 步已不再渲染复制 UI（复制只在 /agent 一处），这里只保留第 3 步填表需要的密钥值
  // 主模型由用户选，协议/地址/默认项全部跟着它走
  const [modelId, setModelId] = useState(() => defaultGuideModel()?.id || '')
  const copy = useCopy()
  const model = findModel(modelId) || defaultGuideModel()
  const protocol = protocolMeta(model?.provider || 'anthropic')
  const modelOptions = useMemo(() => groupModels(), [])
  const modelSummary = useMemo(() => guideModelSummary(), [])

  useEffect(() => {
    if (llm_api_key) setKey(llm_api_key)
  }, [llm_api_key])

  useEffect(() => {
    const tab = params.get('tab')
    const target = tab === 'download' ? 'download' : tab === 'client' ? 'fill' : ''
    if (!target) return
    const node = document.getElementById(target)
    if (node) window.setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [params])

  const fillRows = useMemo(
    () => [
      {
        no: 1,
        label: '预设',
        display: '自定义模型 API',
        copy: '',
        tip: '不要点官方 Claude 登录，选最右边这个'
      },
      { no: 2, label: '配置名称', display: 'RabbitJ', copy: 'RabbitJ', tip: '随便起，认得是本站就行' },
      {
        no: 3,
        label: '接口地址',
        display: protocol.baseUrl,
        copy: protocol.baseUrl,
        tip: protocol.why
      },
      {
        no: 4,
        label: 'API 密钥',
        display: key ? maskKey(key) : '登录后生成',
        copy: key,
        tip: key ? 'sk- 开头的那一串' : '登录后自动生成，点复制就行'
      },
      {
        no: 5,
        label: '主模型',
        display: model?.id || '',
        copy: model?.id || '',
        tip: `已按 ${providerLabel(model?.provider || 'anthropic')} 自动选好协议，换模型这里会跟着变`
      },
      {
        no: 6,
        label: '其余模型映射',
        display: protocol.mappingLabel,
        copy: '',
        tip: '默认就是「与主模型相同」，不用改'
      }
    ],
    [key, model, protocol]
  )

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <ApiOutlined /> 兼容 OpenAI / Anthropic 协议
            </p>
            <h1>接入指南</h1>
            <p className={styles.lead}>
              全程按 <b>Claude-haha</b> 的实际界面走：装 Claude-haha → 复制本站地址和密钥 → 照着 Claude-haha 的「添加模型」
              窗口填 4 个框。其他客户端最后附一句对照，不用来回翻。
            </p>
            {/* 2026-10-24 站长反馈：客户为了找地址和密钥，在教程里翻了半天。
                这两个值已经搬到独立的「接入」页，这里给它一个显眼的入口，
                让「在教程里找值」这件事彻底消失。 */}
            <div className={styles.headCta}>
              <Link to="/agent">
                <Button type="primary" size="large" icon={<LinkOutlined />}>
                  去「接入」页拿地址和密钥
                </Button>
              </Link>
              <span>打开就是那两个值，还能一键复制。这边只讲怎么填。</span>
            </div>
          </header>

          {/* 第 1 步：装客户端（原来是页面最底部的大图卡片，现在挪到最前面，改成紧凑列表） */}
          <section id="download" className={styles.stepCard}>
            <div className={styles.stepHead}>
              <span className={styles.stepNo}>1</span>
              <div>
                <h2>先装 Claude-haha</h2>
                <p>本站教程默认用 Claude-haha：写代码、画图一个软件就够用，免费。装好再回来做第 2 步。</p>
              </div>
            </div>
            <ClientDownloads />
          </section>

          {/* 第 2 步：拿到地址和密钥
              ------------------------------------------------------------
              2026-10-24 站长反馈：客户为了找「接口地址」和「密钥」，在教程里翻了半天。
              这两个值已独立到 /agent，所以这里**不再渲染任何复制 UI**。
              为什么连「本页也能复制」也不留（UI 设计师复核意见）：
              复制界面两处都有，将来换域名/改地址必然漏改一处，教程就会给出旧值。
              现在全站只有 /agent 一个地方能复制，值永远和代码同源。
              教程这边只留一句说明 + 一个主按钮，第 3、4 步讲怎么填。 */}
          <section id="key" className={styles.stepCard}>
            <div className={styles.stepHead}>
              <span className={styles.stepNo}>2</span>
              <div>
                <h2>拿到地址和密钥</h2>
                <p>
                  这两个值在独立的「接入」页：打开就是它们，还能一键复制。拿到再回来看第 3 步怎么填。
                </p>
              </div>
            </div>

            <div className={styles.takeCard}>
              <div>
                <strong>接口地址 + API 密钥</strong>
                <p>不知道填哪、或者报错了，回来继续看第 3、4 步。</p>
              </div>
              <Link to="/agent">
                <Button type="primary" size="large" icon={<LinkOutlined />}>
                  去接入页拿地址和密钥
                </Button>
              </Link>
            </div>
          </section>

          {/* 第 3 步：照着 Claude-haha 的真实界面填 */}
          <section id="fill" className={styles.stepCard}>
            <div className={styles.stepHead}>
              <span className={styles.stepNo}>3</span>
              <div>
                <h2>在客户端里填这 4 个框</h2>
                <p>
                  <b>以 Claude-haha 为例</b>：打开它的「添加模型」窗口，左边就是那个窗口的示意，右边照着填。
                  弹窗下面还有一长串默认项，<b>不用改</b>，只在要画图时补一组。
                </p>
              </div>
            </div>

            {/* 醒目提示：这里只是「以 Claude-haha 为例」，别的客户端一样填 */}
            <div className={styles.exampleCallout}>
              <IconBadge icon={<SettingOutlined />} tone="brand" size="sm" />
              <p>
                <b>下面全部以 Claude-haha 为例。</b>
                用 Codex、Cursor、ChatBox、Cherry Studio 或其他客户端？填的东西是完全一样的三样：
                <b>接口地址 + API 密钥 + 模型名</b>，照着同样的位置填进去就行，界面长得不一样不影响。
              </p>
            </div>

            {/* 模型选择：全站模型都在这里，选完协议/地址/默认项自动变 */}
            <div className={styles.modelPick}>
              <div className={styles.modelPickHead}>
                <IconBadge icon={<ApiOutlined />} tone="brand" size="sm" />
                <div>
                  <strong>先选你要用的主模型</strong>
                  <p>
                    本站全部 <b>{modelSummary.total} 个</b>可对话模型都在这里，按厂商分组（共 {modelSummary.providers} 家）。
                    选哪个，下面的接口地址、API 格式、模型映射就自动变成它该用的那一套。
                  </p>
                </div>
              </div>
              <div className={styles.modelPickRow}>
                <Select
                  showSearch
                  value={model?.id}
                  options={modelOptions}
                  style={{ minWidth: 260, flex: '1 1 260px' }}
                  onChange={setModelId}
                  optionFilterProp="value"
                  placeholder="搜索或选择模型"
                />
                <span className={styles.protocolTag}>
                  {providerLabel(model?.provider || 'anthropic')} · {protocol.formatLabel}
                </span>
              </div>
              <p className={styles.modelPickWhy}>{protocol.why}</p>
            </div>

            <div className={styles.fillGrid}>
              {model ? <HahaMock model={model} /> : null}
              <ol className={styles.fillList}>
                {fillRows.map((row) => (
                  <li key={row.no} className={styles.fillRow}>
                    <span className={styles.fillNo}>{row.no}</span>
                    <div className={styles.fillMain}>
                      <strong>{row.label}</strong>
                      <code>{row.display}</code>
                      <em>{row.tip}</em>
                    </div>
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      disabled={!row.copy}
                      onClick={() => void copy(row.copy, row.label)}
                    >
                      复制
                    </Button>
                  </li>
                ))}
              </ol>
            </div>

            <div className={styles.defaultStrip}>
              <span className={styles.defaultLead}>下面这些按当前模型自动定，其余保持默认</span>
              <span>API 格式 · {protocol.formatLabel}</span>
              <span>认证变量 · {protocol.authLabel}</span>
              <span>模型映射 · {protocol.mappingLabel}</span>
              <span>回复输出预算 · 自动</span>
              <span>上下文与自动压缩 · 高级里别碰</span>
            </div>

            <div className={styles.drawBlock}>
              <div className={styles.drawHead}>
                <IconBadge icon={<PictureOutlined />} tone="violet" size="sm" />
                <strong>还要在 Claude-haha 里画图？把这组补上</strong>
              </div>
              <p>
                图片不走 Anthropic 协议，要单独告诉它走 OpenAI 兼容 Images，地址带 <code>/v1</code>；不填也能聊天，只是画不了图。
              </p>
              <div className={styles.drawGrid}>
                <div className={styles.drawItem}>
                  <span>启用图片生成</span>
                  <b>打开</b>
                </div>
                <div className={styles.drawItem}>
                  <span>图片 API 协议</span>
                  <b>OpenAI 兼容 Images</b>
                </div>
                <div className={styles.drawItem}>
                  <span>生图模型</span>
                  <b className={styles.mono}>{IMAGE_MODEL}</b>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void copy(IMAGE_MODEL, '生图模型')}>
                    复制
                  </Button>
                </div>
                <div className={styles.drawItem}>
                  <span>生图 API 地址</span>
                  <b className={styles.mono}>{RELAY_URL}</b>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void copy(RELAY_URL, '生图地址')}>
                    复制
                  </Button>
                </div>
                <div className={styles.drawItem}>
                  <span>生图 API Key</span>
                  <b>留空，自动复用上面的聊天密钥</b>
                </div>
              </div>
            </div>

            <p className={styles.altNote}>
              换模型不用自己改协议：上面选好模型，这套值就会自动切。
              {protocol.key === 'anthropic' ? (
                <>
                  {' '}
                  想用 GPT / Gemini / DeepSeek 系？在上面下拉里换一个，地址会变成带 <code>/v1</code> 的那条，格式换成 OpenAI
                  兼容。
                </>
              ) : (
                <>
                  {' '}
                  想用 Claude 系？在上面下拉里换一个 claude- 开头的，地址会变回不带 <code>/v1</code> 的那条，格式换成
                  Anthropic Messages。
                </>
              )}
            </p>

            <div className={styles.otherNote}>
              <div className={styles.otherHead}>
                <IconBadge icon={<SettingOutlined />} tone="amber" size="sm" />
                <strong>其他客户端参照执行</strong>
              </div>
              <p>
                Codex、Cursor、Cline、ChatBox、Cherry Studio 都一样：在「服务商 / API / Base URL」里填上面三样——
                接口地址（带 /v1）、API 密钥、模型名。找不到设置项时，在软件设置里搜 <code>API</code> 或 <code>模型</code>。
              </p>
              <div className={styles.chips}>
                {['Codex', 'Cursor', 'Cline', 'ChatBox', 'Cherry Studio'].map((name) => (
                  <span key={name} className={styles.chip}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* 第 4 步：验证 */}
          <section className={styles.tryCard}>
            <IconBadge icon={<CheckCircleFilled />} tone="mint" size="md" />
            <div>
              <h2>发一句话试试</h2>
              <p>
                新建对话，发「用 Python 写一个猜数字游戏」。能正常回话就说明接通了，可以去{' '}
                <Link to="/price">充值商城</Link> 看用量。
              </p>
              <p className={styles.tryHint}>
                报 401 → 密钥没复制全；提示找不到模型 → 模型名和价目页差一个字都不行。
              </p>
            </div>
          </section>

          <details className={styles.fold}>
            <summary>
              <ApiOutlined /> 我要自己写代码调接口
            </summary>
            <div className={styles.foldBody}>
              <DocsPanel />
            </div>
          </details>

          <details className={styles.fold}>
            <summary>
              <MessageOutlined /> 常见问题
            </summary>
            <div className={styles.foldBody}>
              <ul className={styles.faq}>
                <li>
                  <strong>提示未授权 / 401</strong>
                  密钥不完整或已被禁用。复制整串 sk- 开头的字符，别带空格和换行；禁用过的去第 2 步重新启用。
                </li>
                <li>
                  <strong>找不到模型</strong>
                  模型名要和「充值商城」页完全一致，大小写、后缀都算。
                </li>
                <li>
                  <strong>连接超时 / 提示 404</strong>
                  两个地址各试一次：Claude-haha 的 Anthropic 格式用不带 <code>/v1</code> 的那条；OpenAI 兼容格式用带 <code>/v1</code> 的那条，两者别混。
                </li>
                <li>
                  <strong>Claude-haha 里「获取模型」是空的</strong>
                  说明地址或密钥有一个不对，回第 2 步按顺序重新复制一遍。
                </li>
              </ul>
            </div>
          </details>

          <p className={styles.footerTip}>
            <KeyOutlined /> 密钥只保存在你自己的客户端里，本站不代管、不写入日志。
          </p>
        </div>
      </Layout>
    </div>
  )
}

export default GuidePage
