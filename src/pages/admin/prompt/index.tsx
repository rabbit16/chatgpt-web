import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message
} from 'antd'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  deleteAdminPromptInjection,
  getAdminPromptInjections,
  upsertAdminPromptInjection,
  type PromptInjectionRule
} from '@/request/api'
import styles from './index.module.less'

const CATEGORIES = [
  { value: 'anthropic', label: 'Claude' },
  { value: 'openai', label: 'GPT / OpenAI' },
  { value: 'xai', label: 'Grok' },
  { value: 'google', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱' },
  { value: 'other', label: '其他' }
]

const STABILITY_EXAMPLE =
  '如果认为任务输出时间过长，需要拆分成多个子任务，避免单一脚本输出时间过长导致任务异常结束。'

type FormValues = {
  name: string
  scope: 'all' | 'category' | 'model'
  target?: string
  content: string
  position: 'append' | 'prepend' | 'first'
  is_active: boolean
  sort_order: number
  note?: string
}

function scopeLabel(row: PromptInjectionRule) {
  if (row.scope === 'all') return '全部模型'
  if (row.scope === 'category') {
    return CATEGORIES.find((item) => item.value === row.target)?.label || row.target || '类别'
  }
  return row.target || '指定模型'
}

function AdminPrompt() {
  const [form] = Form.useForm<FormValues>()
  const [rows, setRows] = useState<PromptInjectionRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PromptInjectionRule | null>(null)
  const [saving, setSaving] = useState(false)
  const scope = Form.useWatch('scope', form)
  const position = Form.useWatch('position', form)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAdminPromptInjections()
      setRows(data.injections || [])
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : '读取 Prompt 注入失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditing(null)
    form.setFieldsValue({
      name: '',
      scope: 'category',
      target: 'anthropic',
      content: '',
      position: 'first',
      is_active: true,
      sort_order: 100,
      note: ''
    })
    setOpen(true)
  }

  function openEdit(row: PromptInjectionRule) {
    setEditing(row)
    form.setFieldsValue({
      name: row.name,
      scope: row.scope === 'model' || row.scope === 'all' ? row.scope : 'category',
      target: row.target,
      content: row.content,
      position: row.position === 'prepend' || row.position === 'first' ? row.position : 'append',
      is_active: row.is_active,
      sort_order: row.sort_order ?? 100,
      note: row.note || ''
    })
    setOpen(true)
  }

  function fillExample() {
    form.setFieldsValue({
      name: form.getFieldValue('name') || 'Claude 长输出拆分',
      scope: 'category',
      target: 'anthropic',
      position: 'append',
      content: STABILITY_EXAMPLE
    })
  }

  async function save() {
    let values: FormValues
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    const target = values.scope === 'all' ? '' : (values.target || '').trim()
    setSaving(true)
    try {
      const data = await upsertAdminPromptInjection({
        id: editing?.id,
        name: values.name.trim(),
        scope: values.scope,
        target,
        content: values.content.trim(),
        position: values.position,
        is_active: values.is_active,
        sort_order: values.sort_order,
        note: (values.note || '').trim()
      })
      setRows(data.injections || [])
      setOpen(false)
      message.success('已保存，中转会按新规则注入，无需重启')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: PromptInjectionRule) {
    try {
      await deleteAdminPromptInjection(row.id)
      message.success(`已删除 ${row.name}`)
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Prompt 注入</h1>
          <p>
            给经过本站的对话请求追加提示。可以按 Claude、GPT 等类别分别配置，命中的规则会一起生效。选「仅首轮」时，只在第一次用户消息末尾插入一次。
          </p>
        </div>
        <div className={styles.actions}>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            重新读取
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增规则
          </Button>
        </div>
      </header>

      {error ? <Alert showIcon type="error" message={error} className={styles.alert} /> : null}
      <Alert
        showIcon
        type="info"
        className={styles.alert}
        message="保存后立即对后续请求生效"
        description="Claude Code、Codex、Cursor 和本站对话都会带上命中的提示。原有系统提示会保留。绘图和音频请求不会注入。注入文字会计入输入 token。其它进程大约 30 秒内跟上。"
      />

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: '还没有注入规则' }}
        columns={[
          {
            title: '名称',
            dataIndex: 'name',
            width: 180,
            render: (name: string, row) => (
              <div>
                <div className={styles.name}>{name}</div>
                {row.note ? <div style={{ color: '#98a2b3', fontSize: 12 }}>{row.note}</div> : null}
              </div>
            )
          },
          {
            title: '作用范围',
            width: 160,
            render: (_value, row) => (
              <Tag color={row.scope === 'all' ? 'blue' : row.scope === 'model' ? 'purple' : 'green'}>
                {row.scope === 'all' ? '全部' : row.scope === 'model' ? '指定模型' : '类别'} · {scopeLabel(row)}
              </Tag>
            )
          },
          {
            title: '注入内容',
            dataIndex: 'content',
            render: (content: string) => <div className={styles.content}>{content}</div>
          },
          {
            title: '位置',
            dataIndex: 'position',
            width: 88,
            render: (position: string) =>
              position === 'prepend' ? '最前面' : position === 'first' ? '仅首轮' : '追加'
          },
          {
            title: '排序',
            dataIndex: 'sort_order',
            width: 72
          },
          {
            title: '状态',
            dataIndex: 'is_active',
            width: 80,
            render: (active: boolean) => <Tag color={active ? 'success' : 'default'}>{active ? '启用' : '停用'}</Tag>
          },
          {
            title: '操作',
            width: 140,
            render: (_value, row) => (
              <Space>
                <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Popconfirm title={`删除 ${row.name}？`} okText="删除" cancelText="取消" onConfirm={() => void remove(row)}>
                  <Button type="link" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? `编辑 · ${editing.name}` : '新增 Prompt 注入'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        width={680}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input maxLength={80} placeholder="例如 Claude 长输出拆分" />
          </Form.Item>
          <Form.Item name="scope" label="作用范围" rules={[{ required: true }]}>
            <Radio.Group
              onChange={(event) => {
                if (event.target.value === 'category' && !CATEGORIES.some((item) => item.value === form.getFieldValue('target'))) {
                  form.setFieldValue('target', 'anthropic')
                }
              }}
            >
              <Radio value="all">全部模型</Radio>
              <Radio value="category">模型类别</Radio>
              <Radio value="model">指定模型</Radio>
            </Radio.Group>
          </Form.Item>
          {scope === 'category' ? (
            <Form.Item name="target" label="模型类别" rules={[{ required: true, message: '请选择类别' }]}>
              <Select options={CATEGORIES} />
            </Form.Item>
          ) : null}
          {scope === 'model' ? (
            <Form.Item
              name="target"
              label="模型名"
              extra="精确名、前缀或片段都可以。claude-sonnet 命中 claude-sonnet-5，opus 命中名字里带 opus 的模型。别名和真实模型名都会参与匹配。"
              rules={[{ required: true, message: '请填写模型名' }]}
            >
              <Input placeholder="claude-sonnet 或 opus" />
            </Form.Item>
          ) : null}
          {scope === 'all' ? (
            <Alert
              showIcon
              type="info"
              style={{ marginBottom: 16 }}
              message="这条会和命中的类别、指定模型规则一起注入。"
            />
          ) : null}
          <Form.Item
            name="content"
            label="注入内容"
            extra={
              position === 'first'
                ? '只在还没有助手回复的那一次，加到最后一条用户消息末尾。之后的请求不再改写，系统提示和工具保持原样，前缀缓存可以继续命中。'
                : '追加到客户端原有系统提示上，不会替换 Claude Code 或 Codex 自己的提示。'
            }
            rules={[{ required: true, message: '请填写要注入的提示' }]}
          >
            <Input.TextArea rows={6} maxLength={8000} showCount placeholder={STABILITY_EXAMPLE} />
          </Form.Item>
          <Button type="link" style={{ paddingLeft: 0, marginTop: -8 }} onClick={fillExample}>
            填入长输出拆分示例（Claude）
          </Button>
          <Form.Item name="position" label="插入位置">
            <Radio.Group>
              <Radio value="first">仅首轮，加在用户消息末尾</Radio>
              <Radio value="append">每轮追加到已有系统提示之后</Radio>
              <Radio value="prepend">每轮放在已有系统提示之前</Radio>
            </Radio.Group>
          </Form.Item>
          <Space size={24} align="start">
            <Form.Item name="sort_order" label="排序" extra="数字小的先出现">
              <InputNumber min={0} max={10000} />
            </Form.Item>
            <Form.Item name="is_active" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="note" label="备注">
            <Input maxLength={200} placeholder="只在后台列表里看到" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminPrompt
