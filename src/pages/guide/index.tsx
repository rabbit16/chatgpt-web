import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApiOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CopyOutlined,
  DownloadOutlined,
  KeyOutlined,
  MessageOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { Button, message } from 'antd'
import Layout from '@/components/Layout'
import IconBadge from '@/components/IconBadge'
import { DocsPanel } from '@/pages/docs'
import { AgentPanel, RELAY_HOST, RELAY_URL } from '@/pages/agent'
import { SoftwarePanel } from '@/pages/software'
import { copyToClipboard } from '@/utils'
import styles from './index.module.less'

/**
 * 接入指南（对齐模板站结构）
 * ------------------------------------------------------------
 * 参考 xbenefitapi.xyz/docs：首屏一张卡解决 90% 的问题——
 *   API 地址（可复制）→ 三步编号 → 选软件 → 模型名，其余内容分节下沉。
 * 这样不用先滚三屏再决定看哪里，也不会出现"同样的话说两遍"。
 */
function GuidePage() {
  const [params] = useSearchParams()
  const [app, setApp] = useState<'haha' | 'codex' | 'cursor'>('haha')

  useEffect(() => {
    const tab = params.get('tab')
    const target = tab === 'download' ? 'download' : tab === 'client' ? 'software-guide' : ''
    if (!target) return
    const node = document.getElementById(target)
    if (node) window.setTimeout(() => node.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [params])

  const copy = async (value: string, tip: string) => {
    try {
      await copyToClipboard(value)
      message.success(`已复制${tip}`)
    } catch {
      message.warning('浏览器限制了自动复制，请手动选中复制')
    }
  }

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const APP_HINT: Record<typeof app, string> = {
    haha: 'Claude-haha：设置 → 服务商 → 添加 OpenAI 兼容，地址填通用地址，密钥填 sk-，模型填 gpt-5.4 或 gpt-6.1-sol。',
    codex: 'Codex：设置 → API，地址填通用地址，密钥填 sk-，模型名与价目表保持一致。',
    cursor: 'Cursor：设置 → Models → OpenAI，Base URL 填通用地址（带 /v1），密钥填 sk-。'
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <header className={styles.head}>
            <p className={styles.kicker}>
              <ApiOutlined /> 兼容 OpenAI 协议
            </p>
            <h1>接入指南</h1>
            <p className={styles.lead}>
              只用填两样：API 地址与 API Key。下面这张卡里可以直接复制，填完就能聊。
            </p>
          </header>

          {/* ① 主卡：复制地址 + 三步 + 选软件 + 模型名（模板站同款结构） */}
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>
                  <CheckCircleFilled className={styles.panelCheck} /> 连接你的第一个客户端
                </h2>
                <p>使用当前 API 地址配置客户端，发送请求前替换占位符里的密钥与模型名。</p>
              </div>
              <Button type="primary" icon={<CopyOutlined />} onClick={() => void copy(RELAY_URL, 'API 地址')}>
                复制 API 地址
              </Button>
            </div>

            <div className={styles.addrRow}>
              <span className={styles.addrLabel}>API 基础地址</span>
              <code>{RELAY_URL}</code>
              <Button size="small" onClick={() => void copy(RELAY_URL, '通用地址')}>
                复制
              </Button>
            </div>
            <div className={styles.addrRow}>
              <span className={styles.addrLabel}>Claude 原生格式</span>
              <code>{RELAY_HOST}</code>
              <Button size="small" onClick={() => void copy(RELAY_HOST, 'Claude 地址')}>
                复制
              </Button>
            </div>

            <div className={styles.stepsRow}>
              <div className={styles.stepItem}>
                <span className={styles.stepDot}>1</span>
                <div>
                  <strong>创建 API 密钥</strong>
                  <button type="button" onClick={() => scrollTo('software-guide')}>
                    打开密钥管理 <ArrowRightOutlined />
                  </button>
                </div>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepDot}>2</span>
                <div>
                  <strong>选择软件</strong>
                  <span>按你电脑上的客户端选择对应协议</span>
                </div>
              </div>
              <div className={styles.stepItem}>
                <span className={styles.stepDot}>3</span>
                <div>
                  <strong>复制并运行</strong>
                  <span>替换占位符后，发送第一条消息</span>
                </div>
              </div>
            </div>

            <div className={styles.appRow}>
              <div className={styles.appTabs} role="tablist" aria-label="选择软件">
                {([
                  ['haha', 'Claude-haha'],
                  ['codex', 'Codex'],
                  ['cursor', 'Cursor']
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={app === key}
                    className={app === key ? `${styles.appTab} ${styles.appTabOn}` : styles.appTab}
                    onClick={() => setApp(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className={styles.appHint}>{APP_HINT[app]}</p>
            </div>

            <div className={styles.modelRow}>
              <span className={styles.addrLabel}>模型名示例</span>
              <code>gpt-6.1-sol</code>
              <code>claude-sonnet-5</code>
              <code>gemini-3.5-flash</code>
              <span className={styles.modelTip}>完整清单见「模型价格」页</span>
            </div>
          </section>

          {/* ② 各软件细化步骤 */}
          <section id="software-guide" className={styles.block}>
            <div className={styles.blockHead}>
              <IconBadge icon={<SettingOutlined />} tone="mint" size="md" />
              <div>
                <h2>各软件的具体填法</h2>
                <p>点开你的软件，照着卡片改两个输入框即可。</p>
              </div>
            </div>
            <AgentPanel />
          </section>

          {/* ③ 客户端下载 */}
          <section id="download" className={styles.block}>
            <div className={styles.blockHead}>
              <IconBadge icon={<DownloadOutlined />} tone="violet" size="md" />
              <div>
                <h2>还没有客户端？先下载</h2>
                <p>都是免费客户端，装完回到上面主卡填两处即可。</p>
              </div>
            </div>
            <SoftwarePanel />
          </section>

          {/* ④ 接口文档（默认折叠，避免首屏信息过载） */}
          <details className={styles.fold}>
            <summary>
              <ApiOutlined /> 我要自己写代码调接口
            </summary>
            <div className={styles.foldBody}>
              <DocsPanel />
            </div>
          </details>

          {/* ⑤ 常见问题 */}
          <details className={styles.fold}>
            <summary>
              <MessageOutlined /> 常见问题
            </summary>
            <div className={styles.foldBody}>
              <ul className={styles.faq}>
                <li>
                  <strong>提示未授权 / 401</strong>
                  密钥不完整或已失效。重新复制 sk- 开头的完整字符串，别带空格。
                </li>
                <li>
                  <strong>找不到模型</strong>
                  模型名要和「模型价格」页展示的完全一致，含大小写与后缀。
                </li>
                <li>
                  <strong>Claude 系连不上</strong>
                  地址换成不带 <code>/v1</code> 的那条，用的客户端要支持 Anthropic 原生格式。
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
