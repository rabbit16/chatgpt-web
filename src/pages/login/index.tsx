import React, { ReactNode } from 'react'
import { Form } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { ApiOutlined, CodeOutlined, WalletOutlined } from '@ant-design/icons'
import styles from './index.module.less'
import { LoginCard } from '@/components/LoginModal'
import Brand from '@/components/Brand'
import IconBadge from '@/components/IconBadge'

type Props = {
  /** 左侧品牌面板标题 */
  title?: ReactNode
  /** 左侧品牌面板说明 */
  description?: ReactNode
}

/**
 * 借用模板站的"三条事实"写法：每条 = 图标方块 + 一句主张 + 一句可核对说明。
 * 不写形容词，只写用户能验证的东西。
 */
const points: { icon: ReactNode; tone: 'brand' | 'mint' | 'violet'; title: string; desc: string }[] = [
  {
    icon: <ApiOutlined />,
    tone: 'brand',
    title: '一个入口，多种模型',
    desc: 'OpenAI 兼容地址，GPT / Claude / Gemini 随选'
  },
  {
    icon: <WalletOutlined />,
    tone: 'mint',
    title: '按实际用量付费',
    desc: '余额、用量与账单可随时核对，无需订阅'
  },
  {
    icon: <CodeOutlined />,
    tone: 'violet',
    title: '开发工具直连',
    desc: 'Claude Code / Codex / Cherry Studio 填写地址即可接入'
  }
]

/**
 * 登录页（T3 · 方向 A 分屏）
 * ------------------------------------------------------------
 * 左：品牌面板（说明"这是什么、能干什么"）
 * 右：登录卡片（表单）
 * 去掉了原来的美团 CDN 背景图，改成本地渐变，不再依赖外部图片。
 */
function LoginPage({
  title = '一个入口，接入主流大模型',
  description = '对话、绘图、用量、接入，都放在同一个账号里'
}: Props) {
  const [loginForm] = Form.useForm()
  const navigate = useNavigate()

  return (
    <div className={styles.login}>
      <aside className={styles.login__brand}>
        <div className={styles.login__brandInner}>
          <span className={styles.login__glow} aria-hidden="true" />
          <img className={styles.login__watermark} src="/logo.svg" alt="" aria-hidden="true" />
          <div className={styles.login__logo}>
            <Brand />
            <Link to="/" className={styles.login__back}>
              返回首页
            </Link>
          </div>

          <div className={styles.login__pitch}>
            <span className={styles.login__eyebrow}>统一 AI 接入，随时投入使用</span>
            <h2 className={styles.login__title}>{title}</h2>
            <p className={styles.login__desc}>{description}</p>
            <ul className={styles.login__points}>
              {points.map((item) => (
                <li key={item.title}>
                  <IconBadge icon={item.icon} tone={item.tone} size="md" />
                  <span className={styles.login__pointText}>
                    <strong>{item.title}</strong>
                    <em>{item.desc}</em>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.login__foot}>© {new Date().getFullYear()} anyGPT · 中转服务</div>
        </div>
      </aside>

      <main className={styles.login__panel}>
        <div className={styles.login__card}>
          <LoginCard
            form={loginForm}
            title="欢迎回来"
            subTitle="登录后继续对话、查看用量与余额"
            onSuccess={() => {
              loginForm.resetFields()
              // 站长 2026-10-24：登录后直接去充值页（/price 是「充值商城」，登录后第一件事是充钱）。
              // 想知道余额、想马上用，都在这条动线上，跳 /chat 反而要多点两下。
              navigate('/price')
            }}
          />
        </div>
      </main>
    </div>
  )
}

export default LoginPage
