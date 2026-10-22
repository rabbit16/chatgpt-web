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
  SettingOutlined
} from '@ant-design/icons'
import { Button, message } from 'antd'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import { DocsPanel } from '@/pages/docs'
import ApiKeyPanel from '@/pages/agent/ApiKeyPanel'
import { getSoftwareList, type SoftwareItem } from '@/request/api'
import { PUBLIC_MODEL_IDS } from '@/data/publicPricing'
import { userStore } from '@/store'
import { copyToClipboard } from '@/utils'
import { CC_HAHA_RELEASES, RELAY_HOST, RELAY_URL } from '@/utils/relay'
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

const EXAMPLE_MODEL = PUBLIC_MODEL_IDS.includes('gpt-6.1-sol') ? 'gpt-6.1-sol' : PUBLIC_MODEL_IDS[0] || 'gpt-6.1-sol'

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

function HahaMock() {
  return (
    <div className={styles.mock} aria-label="Claude-haha 添加模型界面示意">
      <div className={styles.mockBar}>
        <strong>添加模型</strong>
        <span>Claude-haha</span>
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
        <MockField no={3} label="接口地址" value={RELAY_URL} mono />
        <MockField no={4} label="API 密钥" value="sk-••••••••••••" mono />
        <MockField no={5} label="主模型" value={EXAMPLE_MODEL} mono />
        <p className={styles.mockNote}>Fable / Haiku / Sonnet 模型留空；填完点「获取模型」可直接从列表里选。</p>
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
  // 密钥管理默认收起，完全由用户点击控制；没密钥时密钥行会出现「新建密钥」按钮
  const [manageOpen, setManageOpen] = useState(false)
  const copy = useCopy()

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
      { no: 3, label: '接口地址', display: RELAY_URL, copy: RELAY_URL, tip: '整条复制，不要自己加路径' },
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
        display: EXAMPLE_MODEL,
        copy: EXAMPLE_MODEL,
        tip: '写代码用 gpt- 开头；模型名见「价格与充值」'
      }
    ],
    [key]
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
              三件事：<b>装客户端</b>、<b>复制地址和密钥</b>、<b>照着界面填 4 个框</b>。这一页就是全部，不用再翻别处。
            </p>
          </header>

          {/* 第 1 步：装客户端（原来是页面最底部的大图卡片，现在挪到最前面，改成紧凑列表） */}
          <section id="download" className={styles.stepCard}>
            <div className={styles.stepHead}>
              <span className={styles.stepNo}>1</span>
              <div>
                <h2>先装一个客户端</h2>
                <p>推荐 Claude-haha：写代码、画图一个软件就够用，免费。装好再回来做第 2 步。</p>
              </div>
            </div>
            <ClientDownloads />
          </section>

          {/* 第 2 步：地址与密钥 */}
          <section id="key" className={styles.stepCard}>
            <div className={styles.stepHead}>
              <span className={styles.stepNo}>2</span>
              <div>
                <h2>复制地址和密钥</h2>
                <p>地址是本站的，密钥是你账号的。两样都复制好，下一步填进软件。</p>
              </div>
            </div>

            <div className={styles.twoCol}>
              <div className={styles.colBlock}>
                <p className={styles.colTitle}>接口地址</p>
                <div className={styles.addrRow}>
                  <div className={styles.addrMeta}>
                    <strong>OpenAI 兼容</strong>
                    <span>绝大多数客户端填这条</span>
                  </div>
                  <code>{RELAY_URL}</code>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void copy(RELAY_URL, '接口地址')}>
                    复制
                  </Button>
                </div>
                <div className={styles.addrRow}>
                  <div className={styles.addrMeta}>
                    <strong>Anthropic 原生</strong>
                    <span>只认 Claude 格式的客户端用</span>
                  </div>
                  <code>{RELAY_HOST}</code>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void copy(RELAY_HOST, 'Claude 地址')}>
                    复制
                  </Button>
                </div>
                <p className={styles.colHint}>拿不准就填第一条。提示「格式不对」时再换第二条。</p>
              </div>

              <div className={styles.colBlock}>
                <p className={styles.colTitle}>API 密钥</p>
                {!token ? (
                  <div className={styles.keyEmpty}>
                    <p>密钥要登录后生成，一个账号可以建多把，一把用在所有软件里。</p>
                    <Button type="primary" onClick={() => setLoginModal(true)}>
                      登录 / 注册后生成
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className={styles.keyRow}>
                      <code>{key ? maskKey(key) : '还没有可用密钥'}</code>
                      <div className={styles.keyRowActions}>
                        {key ? (
                          <Button
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => void copy(key, 'API 密钥')}
                          >
                            复制
                          </Button>
                        ) : (
                          <Button size="small" type="primary" onClick={() => setManageOpen(true)}>
                            新建密钥
                          </Button>
                        )}
                      </div>
                    </div>
                    <details
                      className={styles.manage}
                      open={manageOpen}
                      onToggle={(event) => setManageOpen((event.currentTarget as HTMLDetailsElement).open)}
                    >
                      <summary>管理密钥（新建 / 禁用 / 删除）</summary>
                      <div className={styles.manageBody}>
                        <ApiKeyPanel embedded onKeyChange={setKey} />
                      </div>
                    </details>
                  </>
                )}
                <p className={styles.colHint}>
                  一把密钥能用在所有客户端。换电脑或担心泄露，就新建一把，旧的禁用即可。
                </p>
              </div>
            </div>
          </section>

          {/* 第 3 步：照着 Claude-haha 的真实界面填 */}
          <section id="fill" className={styles.stepCard}>
            <div className={styles.stepHead}>
              <span className={styles.stepNo}>3</span>
              <div>
                <h2>照着这张界面填 4 个框</h2>
                <p>Claude-haha 里打开「添加模型」，左边是软件窗口示意，右边是对照表，一行对一个框。</p>
              </div>
            </div>

            <div className={styles.fillGrid}>
              <HahaMock />
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
                <Link to="/price">价格与充值</Link> 看用量。
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
                  模型名要和「价格与充值」页完全一致，大小写、后缀都算。
                </li>
                <li>
                  <strong>连接超时 / 格式不对</strong>
                  先确认地址带 <code>/v1</code>；客户端只认 Claude 格式时，改填不带 <code>/v1</code> 的那条。
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
