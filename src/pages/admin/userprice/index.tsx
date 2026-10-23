import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  deleteAdminUserModelPrice,
  getAdminUserModelPrices,
  getGlobalPricing,
  getAdminUsers,
  upsertAdminUserModelPrice,
  type UserModelPriceRule
} from '@/request/api'
import styles from './index.module.less'

type UserOption = { user_id: number; name?: string; telephone?: string; email?: string }

type FormValues = {
  user_id: number
  models: string
  service_tier: string
  input_price: number
  output_price: number
  cache_read_price: number
  cache_write_price: number
  is_active: boolean
  note?: string
}

const tierOptions = [
  { value: 'standard', label: '标准' },
  { value: 'fast', label: 'Fast / 优先' }
]

function userLabel(user?: UserOption | null) {
  if (!user) return '—'
  const parts = [user.telephone, user.name, user.email].filter(Boolean)
  return parts.length ? `${parts.join(' / ')} (#${user.user_id})` : `#${user.user_id}`
}

function parseModelLines(text?: string): string[] {
  return Array.from(
    new Set(
      (text || '')
        .split(/[\n,，;；\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function AdminUserPrice() {
  const [list, setList] = useState<UserModelPriceRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rate, setRate] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<UserModelPriceRule | null>(null)
  const [form] = Form.useForm<FormValues>()
  const [query, setQuery] = useState('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [userSearching, setUserSearching] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminUserModelPrices()
      setList(data.prices || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取用户专属价失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void getGlobalPricing()
      .then((data) => setRate(Number(data.usd_cny_rate) || null))
      .catch(() => setRate(null))
  }, [])

  const searchUsers = async (keyword: string) => {
    setUserSearching(true)
    try {
      const res: any = await getAdminUsers({ page: 1, page_num: 20, keyword })
      const payload = res?.data || {}
      setUserOptions(payload.list || [])
    } catch {
      setUserOptions([])
    } finally {
      setUserSearching(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setUserOptions([])
    form.setFieldsValue({
      user_id: undefined as unknown as number,
      models: '',
      service_tier: 'standard',
      input_price: 0,
      output_price: 0,
      cache_read_price: 0,
      cache_write_price: 0,
      is_active: true,
      note: ''
    })
    setSelectedUser(null)
    setOpen(true)
    void searchUsers('')
  }

  const openEdit = (row: UserModelPriceRule) => {
    setEditing(row)
    const snapshot = row.user || { user_id: row.user_id }
    setUserOptions([snapshot])
    setSelectedUser(snapshot)
    form.setFieldsValue({
      user_id: row.user_id,
      models: row.model,
      service_tier: row.service_tier || 'standard',
      input_price: row.input,
      output_price: row.output,
      cache_read_price: row.cache_read,
      cache_write_price: row.cache_write,
      is_active: row.is_active,
      note: row.note || ''
    })
    setOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    const models = parseModelLines(values.models)
    if (!models.length) {
      message.error('请至少填一个模型名')
      return
    }
    if (values.user_id != null && !selectedUser) {
      const hit = userOptions.find((user) => user.user_id === values.user_id)
      if (hit) setSelectedUser(hit)
    }
    if (editing && models.length > 1) {
      message.error('编辑时只能保存一个模型；要批量新建请点「新增专属价」')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await upsertAdminUserModelPrice({
          id: editing.id,
          user_id: values.user_id,
          model: models[0],
          service_tier: values.service_tier,
          input_price: values.input_price,
          output_price: values.output_price,
          cache_read_price: values.cache_read_price,
          cache_write_price: values.cache_write_price,
          is_active: values.is_active,
          note: values.note
        })
      } else {
        for (const model of models) {
          await upsertAdminUserModelPrice({
            user_id: values.user_id,
            model,
            service_tier: values.service_tier,
            input_price: values.input_price,
            output_price: values.output_price,
            cache_read_price: values.cache_read_price,
            cache_write_price: values.cache_write_price,
            is_active: values.is_active,
            note: values.note
          })
        }
      }
      const data = await getAdminUserModelPrices()
      setList(data.prices || [])
      setOpen(false)
      message.success(editing ? '专属价已更新' : `已保存 ${models.length} 条专属价`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存专属价失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: UserModelPriceRule) => {
    try {
      await deleteAdminUserModelPrice(row.id)
      setList((prev) => prev.filter((item) => item.id !== row.id))
      message.success('已删除')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  const toggle = async (row: UserModelPriceRule, isActive: boolean) => {
    try {
      const data = await upsertAdminUserModelPrice({
        id: row.id,
        user_id: row.user_id,
        model: row.model,
        service_tier: row.service_tier,
        input_price: row.input,
        output_price: row.output,
        cache_read_price: row.cache_read,
        cache_write_price: row.cache_write,
        is_active: isActive,
        note: row.note || ''
      })
      setList(data.prices || [])
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败')
    }
  }

  const filtered = list.filter((row) => {
    const key = query.trim().toLowerCase()
    if (!key) return true
    const label = userLabel(row.user).toLowerCase()
    return row.model.toLowerCase().includes(key) || label.includes(key)
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>用户专属模型价</h1>
          <p>
            给指定用户单独定价。价格按 USD / 百万 tokens 录入，录入多少就是用户最终应付价：扣费时只再乘人民币汇率
            {rate ? `（当前 ${rate}）` : ''}，不再叠加供应商倍率、用户 money_rate 或折扣。用户没有专属价时仍按原来的路由价计算。
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增专属价
          </Button>
        </Space>
      </header>

      {error && <Alert showIcon type="error" message={error} className={styles.alert} />}
      <Alert
        showIcon
        type="info"
        className={styles.alert}
        message="匹配规则"
        description="模型名可取完整名（gpt-6-luna），也可写前缀并以 * 结尾（gemini*）。同一用户下精确名优先于通配；服务档位精确匹配优先。"
      />

      <Input
        allowClear
        value={query}
        placeholder="按模型名或用户搜索"
        style={{ maxWidth: 320, marginBottom: 16 }}
        onChange={(event) => setQuery(event.target.value)}
      />

      <Table
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        dataSource={filtered}
        locale={{ emptyText: '还没有设置用户专属价' }}
        scroll={{ x: 1080 }}
        columns={[
          {
            title: '用户',
            dataIndex: 'user',
            width: 240,
            render: (_: unknown, row: UserModelPriceRule) => <span>{userLabel(row.user)}</span>
          },
          {
            title: '模型',
            dataIndex: 'model',
            render: (value: string) => (
              <Space size={6}>
                <code>{value}</code>
                {value.endsWith('*') ? <Tag color="purple">前缀</Tag> : null}
              </Space>
            )
          },
          {
            title: '档位',
            dataIndex: 'service_tier',
            width: 90,
            render: (value: string) => <Tag>{value === 'fast' ? 'Fast' : '标准'}</Tag>
          },
          { title: '输入', dataIndex: 'input', width: 100, render: (v: number) => `$${v}` },
          { title: '输出', dataIndex: 'output', width: 100, render: (v: number) => `$${v}` },
          { title: '缓存读', dataIndex: 'cache_read', width: 100, render: (v: number) => `$${v}` },
          { title: '缓存写', dataIndex: 'cache_write', width: 100, render: (v: number) => `$${v}` },
          {
            title: '生效',
            dataIndex: 'is_active',
            width: 80,
            render: (active: boolean, row: UserModelPriceRule) => (
              <Switch size="small" checked={active} onChange={(checked) => void toggle(row, checked)} />
            )
          },
          { title: '备注', dataIndex: 'note' },
          {
            title: '操作',
            width: 160,
            render: (_: unknown, row: UserModelPriceRule) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Popconfirm
                  title={`删除 ${row.model} 的专属价？`}
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => void remove(row)}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? `编辑专属价 · ${editing.model}` : '新增用户专属价'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="user_id" label="用户" rules={[{ required: true, message: '请选择用户' }]}>
            <Select
              showSearch
              filterOption={false}
              loading={userSearching}
              placeholder="搜索手机号 / 邮箱 / 昵称 / ID"
              disabled={Boolean(editing)}
              options={userOptions.map((user) => ({ value: user.user_id, label: userLabel(user) }))}
              onSearch={(value) => void searchUsers(value)}
              onSelect={(value: number) => {
                const hit = userOptions.find((user) => user.user_id === value)
                if (hit) setSelectedUser(hit)
              }}
              onDropdownVisibleChange={(visible) => {
                if (visible && userOptions.length === 0) void searchUsers('')
              }}
            />
          </Form.Item>
          <Form.Item
            name="models"
            label="模型名（一行一个）"
            rules={[{ required: true, message: '请输入模型名' }]}
            extra={
              editing
                ? '编辑时只改这一个模型；需要给同一用户批量建价请重新「新增专属价」。'
                : '可批量粘贴。一行一个，支持以 * 结尾的前缀写法，例如 gemini*。整批共用下面这组单价。'
            }
          >
            <Input.TextArea
              rows={5}
              disabled={Boolean(editing)}
              placeholder={'gpt-6-luna\ngemini-3.8-flash\ngemini*'}
            />
          </Form.Item>
          <Form.Item name="service_tier" label="服务档位">
            <Select options={tierOptions} />
          </Form.Item>
          <Space size={12} style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="input_price" label="输入 $/1M" style={{ width: 140 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="output_price" label="输出 $/1M" style={{ width: 140 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cache_read_price" label="缓存读 $/1M" style={{ width: 140 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="cache_write_price" label="缓存写 $/1M" style={{ width: 140 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="例如：大客户协议价" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminUserPrice
