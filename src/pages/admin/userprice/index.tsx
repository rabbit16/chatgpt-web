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
  Typography,
  message
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  deleteAdminUserModelPrice,
  getAdminUserModelPrices,
  getGlobalPricing,
  getAdminUsers,
  getAdminUserPriceBaseline,
  getAdminUserPriceModels,
  upsertAdminUserModelPrice,
  type UserModelPriceRule,
  type UserPriceBaseline,
  type UserPriceUser
} from '@/request/api'
import styles from './index.module.less'

type UserOption = UserPriceUser
type ModelOption = { model: string; service_tier: string; kind: string; source?: 'official' | 'vendor' }

type FormValues = {
  user_ids: number[]
  models: string
  model_pick?: string
  /** 折扣百分比：100 = 不打折，80 = 基准价的 80% */
  discount_pct?: number
  service_tier: string
  input_price: number
  output_price: number
  cache_read_price: number
  cache_write_price: number
  text_input_price: number
  image_input_price: number
  /** 按张计费的档位单价，key 为 1k/2k/4k；空表示按 token 计 */
  per_image_tiers?: { tier?: string; price?: number }[] | null
  is_active: boolean
  note?: string
}

const tierOptions = [
  { value: 'standard', label: '标准' },
  { value: 'fast', label: 'Fast / 优先' }
]

const IMAGE_TIER_KEYS = ['1k', '2k', '4k']

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

/** 把 [{tier,price}] 转成接口要的 { "1k": 0.02 }，留空档位直接丢掉。 */
function tiersToPayload(rows?: { tier?: string; price?: number }[] | null): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const row of rows || []) {
    const key = (row?.tier || '').trim().toLowerCase()
    if (!key || row?.price == null) continue
    out[key] = Number(row.price) || 0
  }
  return Object.keys(out).length ? out : null
}

function tiersToForm(tiers?: Record<string, number> | null) {
  const known = IMAGE_TIER_KEYS.filter((key) => tiers && key in tiers)
  const extra = Object.keys(tiers || {}).filter((key) => !IMAGE_TIER_KEYS.includes(key))
  const keys = [...known, ...extra]
  if (!keys.length) return []
  return keys.map((key) => ({ tier: key, price: Number(tiers?.[key] ?? 0) }))
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
  const [userSearching, setUserSearching] = useState(false)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [baseline, setBaseline] = useState<UserPriceBaseline | null>(null)
  const [baselineLoading, setBaselineLoading] = useState(false)
  const [baselineError, setBaselineError] = useState('')

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
    void getAdminUserPriceModels()
      .then((data) => setModelOptions(data.models || []))
      .catch(() => setModelOptions([]))
  }, [])

  /** 按模型 + 档位拉基准价，再按折扣把整组单价填进表单；填完仍可手工改。 */
  const applyBaseline = async (model: string, tier: string, discountPct?: number) => {
    setBaselineLoading(true)
    setBaselineError('')
    try {
      const data = await getAdminUserPriceBaseline(model, tier)
      const base = data.baseline
      setBaseline(base)
      const factor = Math.max(0, Number(discountPct ?? 100)) / 100
      const scale = (value?: number | null) => Math.round(Number(value || 0) * factor * 1e6) / 1e6
      const known = form.getFieldsValue()
      form.setFieldsValue({
        // 没设过折扣时按 100% 填，避免 undefined 把已填价格冲成 0
        discount_pct: Number(discountPct ?? 100),
        input_price: scale(base.input),
        output_price: scale(base.output),
        cache_read_price: scale(base.cache_read),
        cache_write_price: scale(base.cache_write),
        text_input_price: scale(base.text_input),
        image_input_price: scale(base.image_input),
        per_image_tiers: base.per_image_tiers
          ? Object.entries(base.per_image_tiers).map(([key, price]) => ({ tier: key, price: scale(price) }))
          : known.per_image_tiers?.filter((item) => item?.tier) || []
      })
    } catch (err) {
      setBaseline(null)
      setBaselineError(err instanceof Error ? err.message : '读取基准价失败，可手工填价')
    } finally {
      setBaselineLoading(false)
    }
  }

  const recomputeDiscount = (discountPct: number) => {
    const picked = form.getFieldValue('model_pick') as string | undefined
    if (!picked) {
      message.warning('请先选模型，再设折扣')
      return
    }
    const tier = (form.getFieldValue('service_tier') as string) || 'standard'
    void applyBaseline(picked, tier, discountPct)
  }

  const searchUsers = async (keyword: string) => {
    setUserSearching(true)
    try {
      const res: any = await getAdminUsers({ page: 1, page_num: 20, keyword })
      const payload = res?.data || {}
      const found: UserOption[] = payload.list || []
      // 保留已选用户，避免搜索后下拉里丢了已选项的展示名
      setUserOptions((prev) => {
        const merged = [...prev]
        for (const user of found) {
          if (!merged.some((item) => item.user_id === user.user_id)) merged.push(user)
        }
        return merged
      })
    } catch {
      setUserOptions((prev) => prev)
    } finally {
      setUserSearching(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setUserOptions([])
    setBaseline(null)
    setBaselineError('')
    form.setFieldsValue({
      user_ids: [],
      models: '',
      model_pick: undefined,
      discount_pct: 100,
      service_tier: 'standard',
      input_price: 0,
      output_price: 0,
      cache_read_price: 0,
      cache_write_price: 0,
      text_input_price: 0,
      image_input_price: 0,
      per_image_tiers: [],
      is_active: true,
      note: ''
    })
    setOpen(true)
    void searchUsers('')
  }

  const openEdit = (row: UserModelPriceRule) => {
    setEditing(row)
    setBaseline(null)
    setBaselineError('')
    const snapshots: UserOption[] = row.users?.length
      ? row.users
      : row.user
        ? [row.user]
        : (row.user_ids || [row.user_id]).map((uid) => ({ user_id: uid }))
    setUserOptions(snapshots)
    form.setFieldsValue({
      user_ids: row.user_ids?.length ? row.user_ids : [row.user_id],
      models: row.model,
      model_pick: row.model,
      // 已存在的价无法反推原折扣，默认 100%，重新点「按折扣填充」才会覆盖
      discount_pct: 100,
      service_tier: row.service_tier || 'standard',
      input_price: row.input,
      output_price: row.output,
      cache_read_price: row.cache_read,
      cache_write_price: row.cache_write,
      text_input_price: row.text_input,
      image_input_price: row.image_input,
      per_image_tiers: tiersToForm(row.per_image_tiers),
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
    const user_ids = Array.from(new Set((values.user_ids || []).filter((uid) => uid != null)))
    if (!user_ids.length) {
      message.error('请至少选择一个用户')
      return
    }
    if (editing && models.length > 1) {
      message.error('编辑时只能保存一个模型；要批量新建请点「新增专属价」')
      return
    }
    const payloadBase = {
      user_ids,
      service_tier: values.service_tier,
      input_price: values.input_price,
      output_price: values.output_price,
      cache_read_price: values.cache_read_price,
      cache_write_price: values.cache_write_price,
      text_input_price: values.text_input_price,
      image_input_price: values.image_input_price,
      per_image_tiers: tiersToPayload(values.per_image_tiers),
      is_active: values.is_active,
      note: values.note
    }
    setSaving(true)
    try {
      if (editing) {
        await upsertAdminUserModelPrice({ ...payloadBase, id: editing.id, model: models[0] })
      } else {
        for (const model of models) {
          await upsertAdminUserModelPrice({ ...payloadBase, model })
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
      const data = await upsertAdminUserModelPrice({ id: row.id, is_active: isActive })
      setList(data.prices || [])
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败')
    }
  }

  const filtered = list.filter((row) => {
    const key = query.trim().toLowerCase()
    if (!key) return true
    const label = (row.users?.length ? row.users : [row.user])
      .filter(Boolean)
      .map((user) => userLabel(user))
      .join(' ')
      .toLowerCase()
    return row.model.toLowerCase().includes(key) || label.includes(key)
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>用户专属模型价</h1>
          <p>
            给一组用户单独定价：一条价可以绑定多个用户，组内共用同一套单价；所有字段保存后都能再改。
            价格按 USD / 百万 tokens 录入，录入多少就是用户最终应付价：扣费时只再乘人民币汇率
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
        description="模型名可取完整名（gpt-6-luna），也可写前缀并以 * 结尾（gemini*）。同一用户下精确名优先于通配；服务档位精确匹配优先。同一用户同一模型同一档位只能有一条生效价。"
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
        scroll={{ x: 1200 }}
        columns={[
          {
            title: '用户',
            dataIndex: 'users',
            width: 260,
            render: (_: unknown, row: UserModelPriceRule) => {
              const users = row.users?.length ? row.users : row.user ? [row.user] : []
              if (!users.length) return <span>—</span>
              const shown = users.slice(0, 2)
              return (
                <Space direction="vertical" size={0}>
                  {shown.map((user) => (
                    <span key={user.user_id}>{userLabel(user)}</span>
                  ))}
                  {users.length > shown.length ? (
                    <Typography.Text type="secondary">等 {users.length} 人</Typography.Text>
                  ) : null}
                </Space>
              )
            }
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
            width: 76,
            render: (value: string) => <Tag>{value === 'fast' ? 'Fast' : '标准'}</Tag>
          },
          { title: '输入', dataIndex: 'input', width: 84, align: 'right' as const, render: (v: number) => <span className={styles.num}>${v}</span> },
          { title: '输出', dataIndex: 'output', width: 84, align: 'right' as const, render: (v: number) => <span className={styles.num}>${v}</span> },
          { title: '缓存读', dataIndex: 'cache_read', width: 84, align: 'right' as const, render: (v: number) => <span className={styles.num}>${v}</span> },
          { title: '缓存写', dataIndex: 'cache_write', width: 84, align: 'right' as const, render: (v: number) => <span className={styles.num}>${v}</span> },
          {
            title: '按张计费',
            dataIndex: 'per_image_tiers',
            width: 140,
            render: (tiers?: Record<string, number> | null) =>
              tiers && Object.keys(tiers).length ? (
                <Space size={4} wrap>
                  {Object.entries(tiers).map(([key, price]) => (
                    <Tag key={key}>{key} ${price}</Tag>
                  ))}
                </Space>
              ) : (
                <span>—</span>
              )
          },
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
            width: 150,
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
        width={720}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="user_ids"
            label="用户（可多选，组内共用这套价格）"
            rules={[{ required: true, message: '请至少选择一个用户' }]}
          >
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              loading={userSearching}
              placeholder="搜索手机号 / 邮箱 / 昵称 / ID，可反复添加"
              options={userOptions.map((user) => ({ value: user.user_id, label: userLabel(user) }))}
              onSearch={(value) => void searchUsers(value)}
              onDropdownVisibleChange={(visible) => {
                if (visible) void searchUsers('')
              }}
            />
          </Form.Item>
          <Space size={12} style={{ display: 'flex', flexWrap: 'wrap' }} align="start">
            <Form.Item
              name="model_pick"
              label="选模型（自动带出基准价）"
              style={{ minWidth: 300 }}
              extra="选中后按下面折扣试算，结果会填进单价，仍可继续手改。"
            >
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="搜索模型名"
                options={modelOptions.map((item) => ({
                  value: item.model,
                  label: `${item.model}（${item.service_tier === 'fast' ? 'Fast' : '标准'}）${
                    item.source === 'vendor' ? ' · 仅供应商价' : ''
                  }`
                }))}
                onChange={(value?: string) => {
                  if (!value) {
                    setBaseline(null)
                    return
                  }
                  form.setFieldsValue({ models: value })
                  const tier = (form.getFieldValue('service_tier') as string) || 'standard'
                  void applyBaseline(value, tier, form.getFieldValue('discount_pct') as number)
                }}
              />
            </Form.Item>
            <Form.Item name="service_tier" label="服务档位">
              <Select
                options={tierOptions}
                style={{ width: 140 }}
                onChange={(value: string) => {
                  const picked = form.getFieldValue('model_pick') as string | undefined
                  if (picked) {
                    void applyBaseline(picked, value, form.getFieldValue('discount_pct') as number)
                  }
                }}
              />
            </Form.Item>
            <Form.Item
              name="discount_pct"
              label="折扣（%）"
              style={{ width: 160 }}
              extra="输入 80 = 按基准价 8 折"
            >
              <InputNumber
                min={0}
                max={100}
                step={5}
                style={{ width: '100%' }}
                onChange={(value) => {
                  if (value != null) recomputeDiscount(Number(value))
                }}
              />
            </Form.Item>
          </Space>
          {baselineLoading ? <Alert showIcon type="info" style={{ marginBottom: 12 }} message="正在读取基准价…" /> : null}
          {!baselineLoading && baselineError ? (
            <Alert showIcon type="warning" style={{ marginBottom: 12 }} message={baselineError} />
          ) : null}
          {!baselineLoading && baseline ? (
            <Alert
              showIcon
              type={baseline.source === 'official' ? 'success' : 'warning'}
              style={{ marginBottom: 12 }}
              message={`${baseline.source === 'official' ? '官方标准价' : '供应商成本价（官方目录暂无此模型）'} · ${
                baseline.service_tier === 'fast' ? 'Fast' : '标准'
              }：输入 $${baseline.input} / 输出 $${baseline.output} / 缓存读 $${baseline.cache_read} / 缓存写 $${baseline.cache_write}`}
              description={
                baseline.per_image_tiers
                  ? `按张计费档位：${Object.entries(baseline.per_image_tiers).map(([k, v]) => `${k} $${v}`).join('，')}`
                  : baseline.source === 'official'
                    ? undefined
                    : `已按 ${baseline.vendor_name} 成本价 × ${baseline.price_factor} 折算`
              }
            />
          ) : null}
          <Form.Item
            name="models"
            label="模型名（一行一个）"
            rules={[{ required: true, message: '请输入模型名' }]}
            extra={
              editing
                ? '编辑时只改这一个模型；需要给同一批用户批量建价请重新「新增专属价」。'
                : '可批量粘贴。一行一个，支持以 * 结尾的前缀写法，例如 gemini*。整批共用下面这组单价。'
            }
          >
            <Input.TextArea
              rows={3}
              disabled={Boolean(editing)}
              placeholder={'gpt-6-luna\ngemini-3.8-flash\ngemini*'}
            />
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
          <Alert
            showIcon
            type="warning"
            style={{ marginBottom: 16 }}
            message="按张计费模型（如图像模型）"
            description="填了档位单价就按张计费，未填的档位按更高档兜底；全部留空表示仍按上面的 token 单价计费。文本输入 / 图像输入单价用于同一次请求里的 token 部分。"
          />
          <Space size={12} style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="text_input_price" label="文本输入 $/1M（按张计费时）" style={{ width: 220 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="image_input_price" label="图像输入 $/1M（按张计费时）" style={{ width: 220 }}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.List name="per_image_tiers">
            {(fields, { add, remove }) => (
              <div style={{ marginBottom: 16 }}>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      name={[field.name, 'tier']}
                      rules={[{ required: true, message: '档位' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="1k / 2k / 4k" style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'price']}
                      rules={[{ required: true, message: '单价' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={0.001} placeholder="每张 USD" style={{ width: 160 }} />
                    </Form.Item>
                    <Button size="small" danger onClick={() => remove(field.name)}>
                      移除
                    </Button>
                  </Space>
                ))}
                <Button size="small" onClick={() => add({ tier: IMAGE_TIER_KEYS[fields.length] || '', price: 0 })}>
                  添加按张单价
                </Button>
              </div>
            )}
          </Form.List>
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
