import { useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Switch, Table, Tag, message } from 'antd'
import { createAdminUser, getAdminUsers, updateAdminUser } from '@/request/api'
import styles from '../index.module.less'

const passwordRule = /^(?:[a-zA-Z]{8,}|\d{8,}|(?=.*\d)(?=.*[a-zA-Z])[a-zA-Z\d]{8,})$/

function AdminUsers() {
  const [form] = Form.useForm()
  const [createForm] = Form.useForm()
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [editing, setEditing] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [staff, setStaff] = useState(false)
  const [banned, setBanned] = useState(false)
  const [usernameLogin, setUsernameLogin] = useState(false)

  const loadList = async (nextPage = 1, nextKeyword = keyword) => {
    setLoading(true)
    try {
      const res: any = await getAdminUsers({
        page: nextPage,
        page_num: 10,
        keyword: nextKeyword
      })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadList(1)
  }, [])

  useEffect(() => {
    if (!editing) return
    form.setFieldsValue({
      token: editing.token,
      discount: editing.discount,
      money_rate: editing.money_rate,
      username: editing.username || '',
      password: ''
    })
  }, [editing, form])

  const openEdit = (row: any) => {
    setStaff(Boolean(row.is_staff))
    setBanned(Boolean(row.is_delete))
    setUsernameLogin(Boolean(row.username_login))
    setEditing(row)
    form.setFieldsValue({
      token: row.token,
      discount: row.discount,
      money_rate: row.money_rate,
      username: row.username || '',
      password: ''
    })
  }

  const saveEdit = async () => {
    const values = await form.validateFields()
    const username = (values.username || '').trim()
    const payload: {
      userId: number
      token?: number
      discount?: number
      money_rate?: number
      is_delete: boolean
      is_staff: boolean
      username: string
      username_login: boolean
      password?: string
    } = {
      userId: editing.user_id,
      is_delete: banned,
      is_staff: staff,
      username,
      username_login: username ? usernameLogin : false
    }
    if (typeof values.token === 'number') payload.token = values.token
    if (typeof values.discount === 'number') payload.discount = values.discount
    if (typeof values.money_rate === 'number') payload.money_rate = values.money_rate
    if (values.password) payload.password = values.password
    const res: any = await updateAdminUser(payload)
    if (res?.data?.code === '0' || res?.code === 0) {
      message.success(res?.data?.codeMsg || '已更新')
      setEditing(null)
      loadList(page)
    }
  }

  const saveCreate = async () => {
    const values = await createForm.validateFields()
    const res: any = await createAdminUser({
      username: values.username.trim(),
      password: values.password,
      name: (values.name || '').trim(),
      telephone: (values.telephone || '').trim(),
      email: (values.email || '').trim(),
      token: typeof values.token === 'number' ? values.token : 0,
      username_login: Boolean(values.username_login)
    })
    if (res?.data?.code === '0' || res?.code === 0) {
      message.success(res?.data?.codeMsg || '用户已添加')
      setCreating(false)
      createForm.resetFields()
      loadList(1)
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Input.Search
          allowClear
          placeholder="搜索用户名 / 手机号 / 邮箱 / 昵称 / ID"
          onSearch={(value) => {
            setKeyword(value)
            loadList(1, value)
          }}
          style={{ maxWidth: 360 }}
        />
        <Button type="primary" onClick={() => setCreating(true)}>
          添加用户
        </Button>
      </div>
      <Table
        rowKey="user_id"
        loading={loading}
        dataSource={list}
        scroll={{ x: 1480 }}
        pagination={{
          current: page,
          total,
          pageSize: 10,
          onChange: (next) => loadList(next)
        }}
        columns={[
          { title: 'ID', dataIndex: 'user_id', width: 80 },
          { title: '昵称', dataIndex: 'name' },
          {
            title: '用户名',
            dataIndex: 'username',
            render: (value) => value || '-'
          },
          {
            title: '用户名登录',
            dataIndex: 'username_login',
            width: 110,
            render: (value) => (value ? <Tag color="blue">已开启</Tag> : <Tag>关闭</Tag>)
          },
          {
            title: '匿名',
            dataIndex: 'is_anonymous',
            width: 80,
            render: (value) => (value ? <Tag color="orange">是</Tag> : <Tag>否</Tag>)
          },
          { title: '手机号', dataIndex: 'telephone' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '余额',
            dataIndex: 'token',
            render: (value) => `¥${Number(value || 0).toFixed(4)}`
          },
          { title: '折扣', dataIndex: 'discount' },
          { title: '倍率', dataIndex: 'money_rate' },
          {
            title: '注册时间',
            dataIndex: 'register_time',
            width: 180,
            render: (value) => value || '-'
          },
          {
            title: '管理员',
            dataIndex: 'is_admin',
            width: 90,
            render: (value: boolean, row: any) =>
              value || row.is_staff ? <Tag color="blue">是</Tag> : <Tag>否</Tag>
          },
          {
            title: '状态',
            dataIndex: 'is_delete',
            render: (value) => (value ? <Tag color="red">封禁</Tag> : <Tag color="green">正常</Tag>)
          },
          {
            title: '操作',
            render: (_: unknown, row: any) => (
              <Button type="link" onClick={() => openEdit(row)}>
                编辑
              </Button>
            )
          }
        ]}
      />
      <Modal
        title={`编辑用户 #${editing?.user_id || ''}`}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={saveEdit}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="用户名"
            name="username"
            extra="留空则关闭用户名登录。用户名全局唯一。"
            rules={[
              {
                pattern: /^$|^[A-Za-z0-9_\-\u4e00-\u9fff]{2,32}$/,
                message: '2-32 位字母、数字、下划线、中划线或中文'
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="重置密码"
            name="password"
            extra="不修改请留空"
            rules={[
              {
                pattern: new RegExp(`^$|${passwordRule.source}`),
                message: '8位及以上字母数字'
              }
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="允许用户名登录" extra="关闭后，该用户不能用用户名登录">
            <Switch checked={usernameLogin} onChange={setUsernameLogin} />
          </Form.Item>
          <Form.Item label="余额" name="token">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>
          <Form.Item label="折扣" name="discount">
            <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
          </Form.Item>
          <Form.Item label="倍率" name="money_rate">
            <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
          </Form.Item>
          <Form.Item label="封禁">
            <Switch checked={banned} onChange={setBanned} />
          </Form.Item>
          <Form.Item label="管理员">
            <Switch checked={staff} onChange={setStaff} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="添加用户"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={saveCreate}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" preserve={false} initialValues={{ token: 0, username_login: false }}>
          <Form.Item
            label="用户名"
            name="username"
            extra="全局唯一。只有打开下方开关后，才能用这个用户名登录。"
            rules={[
              { required: true, message: '请填写用户名' },
              {
                pattern: /^[A-Za-z0-9_\-\u4e00-\u9fff]{2,32}$/,
                message: '2-32 位字母、数字、下划线、中划线或中文'
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请填写密码' },
              { pattern: passwordRule, message: '8位及以上字母数字' }
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item label="昵称" name="name">
            <Input />
          </Form.Item>
          <Form.Item label="手机号" name="telephone">
            <Input />
          </Form.Item>
          <Form.Item label="邮箱" name="email">
            <Input />
          </Form.Item>
          <Form.Item label="初始余额" name="token">
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>
          <Form.Item label="允许用户名登录" name="username_login" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminUsers
