import { resetPassword, sendPasswordCode, suggestAnonymousUsername } from '@/request/api'
import { userAsync } from '@/store/async'
import { RequestLoginParams } from '@/types'
import {
  HeartFilled,
  LockOutlined,
  UserOutlined,
  RedditCircleFilled,
  SlackCircleFilled,
  TwitterCircleFilled
} from '@ant-design/icons'
import { LoginForm, ProFormCaptcha, ProFormText } from '@ant-design/pro-form'
import { Alert, Button, Form, FormInstance, Modal, Space, Switch, Tabs, message } from 'antd'
import { ReactNode, useEffect, useState } from 'react'
import { useNavigation, useLocation } from 'react-router-dom'
import md5 from 'md5'
import { copyToClipboard } from '@/utils'
import { userStore } from '@/store'
import styles from './index.module.less'

const ANONYMOUS_NOTICE =
  '匿名用户可以正常使用和充值，但请务必记住用户名和密码。忘记后无法自行找回，本站不承担任何责任。除非联系站长，否则无法找回账号。'
type Props = {
  open: boolean
  onCancel: () => void
  /** 登录/注册成功时触发；onCancel 只关弹窗，成功回调用来做提示和跳转 */
  onSuccess?: () => void
}

type LoginType = 'code' | 'password' | 'register' | 'reset' | string

const passwordRule = /^(?:[a-zA-Z]{8,}|\d{8,}|(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{8,})$/

export function LoginCard(props: {
  form: FormInstance<RequestLoginParams>
  onSuccess: () => void
  type?: LoginType
  /** 卡片标题：分屏登录页与弹窗各自传入 */
  title?: ReactNode
  subTitle?: ReactNode
}) {
  const location = useLocation()

  function getQueryParam(key: string) {
    const queryString = location.search || window.location.search
    const urlParams = new URLSearchParams(queryString)
    return urlParams.get(key) || ''
  }

  const { type = 'password' } = props

  const [loginTabsValue, setLoginTabsValue] = useState<LoginType>('login')
  const [loginType, setLoginType] = useState<LoginType>(type)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeWait, setCodeWait] = useState(0)
  const [anonymous, setAnonymous] = useState(false)
  const [generatedName, setGeneratedName] = useState('')
  const [generatingName, setGeneratingName] = useState(false)
  const anonSignupHint = userStore((state) => state.anonSignupHint)

  const loadAnonymousName = async () => {
    setGeneratingName(true)
    try {
      const res: any = await suggestAnonymousUsername()
      const name = res?.data?.username || ''
      if (res?.data?.code === '0' && name) {
        setGeneratedName(name)
        return name
      }
      message.error(res?.data?.codeMsg || '暂时无法生成用户名')
      return ''
    } finally {
      setGeneratingName(false)
    }
  }

  /**
   * 未登录用户点了发送/新建对话时，直接把他带到「匿名注册」页：
   * 打开开关、自动生成用户名，只剩输入密码一步，降低放弃率。
   */
  useEffect(() => {
    if (!anonSignupHint) return
    setLoginTabsValue('register')
    setLoginType('register')
    setAnonymous(true)
    if (!generatedName && !generatingName) void loadAnonymousName()
    // 只在引导态变化时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anonSignupHint])

  const switchTab = (activeKey: string) => {
    props.form.resetFields()
    const nextType = activeKey === 'login' ? 'password' : activeKey
    setLoginType(nextType)
    setLoginTabsValue(activeKey)
  }
  return (
    <LoginForm<RequestLoginParams>
      form={props.form}
      className={styles.card}
      // logo="https://u1.dl0.cn/icon/openailogo.svg"
      title={props.title ?? ''}
      subTitle={props.subTitle ?? '基于大语言模型的AI对话产品'}
      actions={null}
      contentStyle={{
        width: '100%',
        maxWidth: '360px',
        minWidth: '100px'
      }}
      submitter={{
        searchConfig: {
          submitText: loginType === 'register' ? '注册' : loginType === 'reset' ? '重置密码' : '登录'
        },
        submitButtonProps: {
          block: true,
          size: 'large'
        }
      }}
      onFinish={async (e:any) => {
        if (loginType === 'reset') {
          if (e.password !== e.passwordSecond) {
            message.error('两次输入密码不同')
            return false
          }
          const res: any = await resetPassword({
            email: (e.email || '').trim(),
            code: (e.code || '').trim(),
            password: md5(e.password)
          })
          if (res?.data?.code === '0' || res?.code === 0) {
            message.success(res?.data?.codeMsg || '密码已重置，请登录')
            switchTab('login')
          }
          return false
        }
        if (loginType === 'register') {
          if(e.password!==e.passwordSecond){
            message.error('两次输入密码不同')
            return
          }
          if (anonymous && !generatedName) {
            message.error('请先生成用户名')
            return false
          }
          const passwordMd5 = md5(e.password)
          const payload: any = {
            name: e.name,
            password: passwordMd5,
            anonymous
          }
          if (anonymous) {
            payload.username = generatedName
          } else {
            payload.telephone = e.telephone
            payload.email = e.email
          }
          const res: any = await userAsync.fetchRegister(payload)
          if(res && res.data.code==='0'){
            const finalName = res.data.bodyMessage?.username || generatedName
            if (anonymous) {
              await new Promise((resolve) => {
                Modal.warning({
                  title: '请牢记用户名和密码',
                  closable: false,
                  maskClosable: false,
                  keyboard: false,
                  okText: '我已记住，进入系统',
                  content: (
                    <div>
                      <p>你的用户名是：<b>{finalName}</b></p>
                      <Button
                        type="link"
                        style={{ padding: 0 }}
                        onClick={() => {
                          copyToClipboard(finalName).then(() => message.success('用户名已复制'))
                        }}
                      >
                        复制用户名
                      </Button>
                      <p style={{ marginTop: 12 }}>{ANONYMOUS_NOTICE}</p>
                    </div>
                  ),
                  onOk: () => resolve(true)
                })
              })
              await userAsync.fetchLogin({ password: passwordMd5, userId: finalName } as any)
            } else {
              message.success(res.data.codeMsg || '注册成功')
              await userAsync.fetchLogin({ password: passwordMd5, userId: e.telephone } as any)
            }
            props.onSuccess?.()
          }else{
            message.error(res?.data?.codeMsg || '注册失败')
          }
          return false

        } else {
          return new Promise((resolve, reject) => {
            e.password = md5(e.password)
            userAsync
              .fetchLogin({...e} as any)
              .then((res) => {
                if (res.code) {
                  reject(false)
                  return
                }
                props.onSuccess?.()
                resolve(true)
              })
              .catch(() => {
                reject(false)
              })
          })
        }
      }}
    >
      <Tabs
        centered
        activeKey={loginTabsValue}
        onChange={switchTab}
        items={[
          {
            key: 'login',
            label: '账户登录'
          },
          {
            key: 'register',
            label: '注册账户'
          },
          {
            key: 'reset',
            label: '找回密码'
          }
        ]}
      />

      {loginTabsValue === 'login' && (
        <div>
          <ProFormText
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />
            }}
            name="userId"
            placeholder="电子邮箱/手机号码/用户名"
            rules={[
              {
                required: true
              }
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined className={'prefixIcon'} />
            }}
            placeholder="请输入密码"
            rules={[
              {
                required: true,
                message: '8位及以上字母数字',
                pattern: passwordRule
              }
            ]}
          />
          <div style={{ marginBottom: 12, textAlign: 'right' }}>
            <Button type="link" onClick={() => switchTab('reset')}>
              忘记密码
            </Button>
          </div>
        </div>
      )}
      {loginTabsValue === 'register' ? (
        <div>
          {anonSignupHint ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="不用手机号，3 步开始体验"
              description="系统已为你生成用户名；设一个密码就能开始。换浏览器或清缓存后，这个匿名账号会找不回来。"
            />
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span>匿名注册</span>
            <Switch
              checked={anonymous}
              onChange={(checked) => {
                setAnonymous(checked)
                if (checked) loadAnonymousName()
              }}
            />
          </div>
          {anonymous ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message={ANONYMOUS_NOTICE}
            />
          ) : null}
          {anonymous ? (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, color: '#667085' }}>系统用户名</div>
              <Space>
                <b style={{ fontSize: 18 }}>{generatingName ? '生成中…' : generatedName || '尚未生成'}</b>
                <Button type="link" loading={generatingName} onClick={loadAnonymousName}>
                  换一个
                </Button>
              </Space>
            </div>
          ) : null}
          <ProFormText
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />
            }}
            name="name"
            placeholder="名称"
            rules={[
              {
                required: true,
                message: '请填写名称'
              }
            ]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined className={'prefixIcon'} />
            }}
            placeholder="请输入密码"
            rules={[
              {
                required: true,
                message: '8位及以上字母数字',
                pattern: passwordRule
              }
            ]}
          />
          <ProFormText.Password
            name="passwordSecond"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined className={'prefixIcon'} />
            }}
            placeholder="请再次输入密码"
            rules={[
              {
                required: true,
                message: '8位及以上字母数字',
                pattern: passwordRule
              }
            ]}
          />
          {anonymous ? null : (
            <>
              <ProFormText
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />
                }}
                name="telephone"
                placeholder="电话号码"
                rules={[
                  {
                    required: true,
                    pattern: /^1[3456789]\d{9}$/,
                    message:'请填写正确的电话号码'
                  }
                ]}
              />
              <ProFormText
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />
                }}
                name="email"
                placeholder="电子邮箱"
                rules={[
                  {
                    required: true,
                    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message:'请填写正确的邮箱'
                  }
                ]}
              />
            </>
          )}
        </div>
      ) : null}
      {loginTabsValue === 'reset' ? (
        <div>
          <ProFormText
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />
            }}
            name="email"
            placeholder="注册邮箱"
            rules={[
              {
                required: true,
                pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: '请填写正确的邮箱'
              }
            ]}
          />
          <Space.Compact style={{ width: '100%', marginBottom: 24 }}>
            <ProFormText
              fieldProps={{
                size: 'large',
                prefix: <LockOutlined />
              }}
              formItemProps={{ style: { marginBottom: 0, flex: 1 } }}
              name="code"
              placeholder="邮箱验证码"
              rules={[{ required: true, message: '请输入验证码' }]}
            />
            <Button
              size="large"
              loading={sendingCode}
              disabled={codeWait > 0}
              onClick={async () => {
                const email = String(props.form.getFieldValue('email') || '').trim()
                if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
                  message.error('请先填写正确的邮箱')
                  return
                }
                setSendingCode(true)
                try {
                  const res: any = await sendPasswordCode({ email })
                  if (res?.data?.code === '0' || res?.code === 0) {
                    message.success(res?.data?.codeMsg || '验证码已发送')
                    setCodeWait(60)
                    const timer = window.setInterval(() => {
                      setCodeWait((value) => {
                        if (value <= 1) {
                          window.clearInterval(timer)
                          return 0
                        }
                        return value - 1
                      })
                    }, 1000)
                  }
                } finally {
                  setSendingCode(false)
                }
              }}
            >
              {codeWait > 0 ? `${codeWait}s` : '获取验证码'}
            </Button>
          </Space.Compact>
          <ProFormText.Password
            name="password"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />
            }}
            placeholder="新密码"
            rules={[
              {
                required: true,
                message: '8位及以上字母数字',
                pattern: passwordRule
              }
            ]}
          />
          <ProFormText.Password
            name="passwordSecond"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined />
            }}
            placeholder="再次输入新密码"
            rules={[
              {
                required: true,
                message: '8位及以上字母数字',
                pattern: passwordRule
              }
            ]}
          />
        </div>
      ) : null}
      <div
        style={{
          marginBlockEnd: 24
        }}
      />
    </LoginForm>
  )
}

// 登录注册弹窗
function LoginModal(props: Props) {
  const [loginForm] = Form.useForm()

  const onCancel = () => {
    props.onCancel()
    loginForm.resetFields()
  }

  /** 登录/注册成功：先关弹窗，再交给上层做提示与跳转（两者语义不同，不能共用 onCancel） */
  const handleLoggedIn = () => {
    props.onCancel()
    loginForm.resetFields()
    props.onSuccess?.()
  }

  return (
    <Modal
      open={props.open}
      footer={null}
      destroyOnClose
      onCancel={onCancel}
      width={460}
      centered
      className={styles.modal}
      // antd 5.7.3 的 Modal 没有 styles.body（5.22 才加），原写法被静默忽略
      bodyStyle={{ padding: '28px 28px 20px' }}
    >
      <LoginCard
        form={loginForm}
        onSuccess={handleLoggedIn}
        title="登录 anyGPT"
        subTitle="登录后继续对话、查看用量与余额"
      />
    </Modal>
  )
}

export default LoginModal
