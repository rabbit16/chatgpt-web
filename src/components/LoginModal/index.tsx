import { getCode } from '@/request/api'
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
import { Button, Form, FormInstance, Modal, Space, Tabs, message } from 'antd'
import { useState } from 'react'
import { useNavigation, useLocation } from 'react-router-dom'
import md5 from 'md5'
type Props = {
  open: boolean
  onCancel: () => void
}

type LoginType = 'code' | 'password' | 'register' | string

export function LoginCard(props: {
  form: FormInstance<RequestLoginParams>
  onSuccess: () => void
  type?: LoginType
}) {
  const location = useLocation()

  function getQueryParam(key: string) {
    const queryString = location.search || window.location.search
    const urlParams = new URLSearchParams(queryString)
    return urlParams.get(key) || ''
  }

  const { type = 'password' } = props

  const [loginTabsValue, setLoginTabsValue] = useState<LoginType>('login') // 登陆注册tab标志
  const [loginType, setLoginType] = useState<LoginType>(type) // 登陆注册标志验证码
  console.log(loginTabsValue)
  return (
    <LoginForm<RequestLoginParams>
      form={props.form}
      // logo="https://u1.dl0.cn/icon/openailogo.svg"
      title=""
      subTitle="基于大语言模型的AI对话产品"
      actions={(
        <div
          style={{
            textAlign: 'center',
            fontSize: 14
          }}
        >
          <p>
            登录即代表你同意 <a href="https://www.baidu.com/">《平台协议》</a>和
            <a href="https://www.baidu.com/">《隐私政策》</a>{' '}
          </p>
        </div>
      )}
      contentStyle={{
        width: '100%',
        maxWidth: '340px',
        minWidth: '100px'
      }}
      submitter={{
        searchConfig: {
          submitText: loginType === 'register' ? '注册' : '登录'
        }
      }}
      onFinish={async (e:any) => {
        console.log(loginTabsValue)
        if (loginType === 'register') {
          if(e.password!==e.passwordSecond){
            message.error('两次输入密码不同')
            return
          }
          e.password = md5(e.password)
          delete e.passwordSecond
          let res = await userAsync.fetchRegister({...e})
          if(res && res.data.code==='0'){
            debugger
            message.success(res.data.statusInfo)
            let datalogin =  await userAsync.fetchLogin({password: e.password,userId: e.telephone} as any)
            console.log(datalogin);
            
          }else{
            message.error(res.data.codeMsg)
          }
          props.onSuccess?.()
          return await false

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
        onChange={(activeKey) => {
          props.form.resetFields()
          const type = activeKey === 'login' ? 'password' : activeKey
          setLoginType(type)
          setLoginTabsValue(activeKey)
        }}
        items={[
          {
            key: 'login',
            label: '账户登录'
          },
          {
            key: 'register',
            label: '注册账户'
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
            placeholder="电子邮箱/手机号码"
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
                pattern: /^(?:[a-zA-Z]{8,}|\d{8,}|(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{8,})$/
              }
            ]}
          />
        </div>
      )}
      {loginTabsValue !== 'login' ? (
        <div>
          <ProFormText
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />
            }}
            name="code"
            placeholder="网名"
            rules={[
              {
                required: false
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
                pattern: /^(?:[a-zA-Z]{8,}|\d{8,}|(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{8,})$/
              }
            ]}
          />
          <ProFormText.Password
            name="passwordSecond"
            fieldProps={{
              size: 'large',
              prefix: <LockOutlined className={'prefixIcon'} />
            }}
            placeholder="请在次输入密码"
            rules={[
              {
                required: true,
                message: '8位及以上字母数字',
                pattern: /^(?:[a-zA-Z]{8,}|\d{8,}|(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{8,})$/
              }
            ]}
          />
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
          <ProFormText
            fieldProps={{
              size: 'large',
              prefix: <UserOutlined />
            }}
            name="name"
            placeholder="姓名"
            rules={[
              {
                required: false
              }
            ]}
          />
        </div>
      ) : (
        ''
      )}
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

  return (
    <Modal open={props.open} footer={null} destroyOnClose onCancel={onCancel}>
      <LoginCard form={loginForm} onSuccess={onCancel} />
    </Modal>
  )
}

export default LoginModal
