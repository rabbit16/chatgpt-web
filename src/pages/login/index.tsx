import React, { ReactNode } from 'react'
import { Form } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import styles from './index.module.less'
import { LoginCard } from '@/components/LoginModal'
import Brand from '@/components/Brand'

type Props = {
  /** 左侧品牌面板标题 */
  title?: ReactNode
  /** 左侧品牌面板说明 */
  description?: ReactNode
}

const points = [
  '一个账号，通用 GPT / Claude / Gemini 等主流模型',
  '对话、绘图、用量与余额一站式查看',
  '支持 Claude Code / Codex 等开发工具直连'
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
          <div className={styles.login__logo}>
            <Brand />
            <Link to="/" className={styles.login__back}>
              返回首页
            </Link>
          </div>

          <div className={styles.login__pitch}>
            <h2 className={styles.login__title}>{title}</h2>
            <p className={styles.login__desc}>{description}</p>
            <ul className={styles.login__points}>
              {points.map((item) => (
                <li key={item}>{item}</li>
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
              navigate('/')
            }}
          />
        </div>
      </main>
    </div>
  )
}

export default LoginPage
