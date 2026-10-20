import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, message } from 'antd'
import Layout from '@/components/Layout'
import { getSession, updateProfile } from '@/request/api'
import { userStore } from '@/store'
import styles from './index.module.less'
import md5 from 'md5'

const passwordRule = /^(?:[a-zA-Z]{8,}|\d{8,}|(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{8,})$/

function readBody(info: any) {
  return info?.data?.bodyMessage || info?.bodyMessage || {}
}

function patchStoredProfile(body: Record<string, unknown>) {
  const current = userStore.getState().user_info as any
  if (!current) return
  const next = { ...current }
  if (current.data) {
    next.data = {
      ...current.data,
      bodyMessage: {
        ...(current.data.bodyMessage || {}),
        ...body
      }
    }
  }
  if (current.bodyMessage) {
    next.bodyMessage = {
      ...current.bodyMessage,
      ...body
    }
  }
  userStore.setState({ user_info: next })
}

function ProfilePage() {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const userInfo = userStore((state) => state.user_info)
  const stored = readBody(userInfo)

  useEffect(() => {
    form.setFieldsValue({
      name: stored.userName || '',
      telephone: stored.telephone || '',
      email: stored.email || '',
      username: stored.username || ''
    })
  }, [form, stored.userName, stored.telephone, stored.email, stored.username])

  useEffect(() => {
    getSession().then((res: any) => {
      const body = res?.data?.bodyMessage
      if (!body || String(res?.data?.code) !== '0') return
      patchStoredProfile(body)
      form.setFieldsValue({
        name: body.userName || '',
        telephone: body.telephone || '',
        email: body.email || '',
        username: body.username || ''
      })
    })
  }, [form])

  const onFinish = async (values: {
    name: string
    telephone?: string
    email?: string
    old_password?: string
    new_password?: string
    new_password_second?: string
  }) => {
    if (values.new_password || values.old_password || values.new_password_second) {
      if (!values.old_password || !values.new_password) {
        message.error('修改密码需要同时填写原密码和新密码')
        return
      }
      if (values.new_password !== values.new_password_second) {
        message.error('两次输入的新密码不同')
        return
      }
    }
    setSaving(true)
    try {
      const res: any = await updateProfile({
        name: values.name.trim(),
        telephone: (values.telephone || '').trim(),
        email: (values.email || '').trim(),
        old_password: values.old_password ? md5(values.old_password) : undefined,
        new_password: values.new_password ? md5(values.new_password) : undefined
      })
      if (res?.data?.code === '0' || res?.code === 0) {
        message.success(res?.data?.codeMsg || '资料已更新')
        if (res?.data?.bodyMessage) patchStoredProfile(res.data.bodyMessage)
        form.setFieldsValue({
          old_password: '',
          new_password: '',
          new_password_second: ''
        })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <div className={styles.card}>
            <h1>个人资料</h1>
            <p>可以修改名称、手机号、邮箱和登录密码。</p>
            {stored.is_anonymous ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="这是匿名账号。可以正常使用和充值，但请牢记用户名和密码。忘记后无法自行找回，本站不承担任何责任。除非联系站长，否则无法找回账号。"
              />
            ) : null}
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item
                label="名称"
                name="name"
                rules={[{ required: true, message: '请填写名称' }]}
              >
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item
                label="用户名"
                name="username"
                extra={stored.is_anonymous ? '这是系统生成的登录用户名，请牢记。' : '用户名由管理员设置，这里只作展示。'}
              >
                <Input disabled placeholder="未设置" />
              </Form.Item>
              <Form.Item
                label="手机号"
                name="telephone"
                rules={[
                  {
                    pattern: /^$|^1[3456789]\d{9}$/,
                    message: '请填写正确的电话号码'
                  }
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="邮箱"
                name="email"
                extra="找回密码会把验证码发到这个邮箱。"
                rules={[
                  {
                    pattern: /^$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                    message: '请填写正确的邮箱'
                  }
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item label="原密码" name="old_password" extra="不改密码可以留空。">
                <Input.Password />
              </Form.Item>
              <Form.Item
                label="新密码"
                name="new_password"
                rules={[
                  {
                    pattern: new RegExp(`^$|${passwordRule.source}`),
                    message: '8位及以上字母数字'
                  }
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item
                label="确认新密码"
                name="new_password_second"
                rules={[
                  {
                    pattern: new RegExp(`^$|${passwordRule.source}`),
                    message: '8位及以上字母数字'
                  }
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving}>
                保存
              </Button>
            </Form>
          </div>
        </div>
      </Layout>
    </div>
  )
}

export default ProfilePage
