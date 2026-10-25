import { useEffect, useState } from 'react'
import {
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
  message
} from 'antd'
import {
  CloudUploadOutlined,
  InboxOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  createAdminSoftware,
  createAdminSoftwareCategory,
  getAdminSoftware,
  getAdminSoftwareCategories,
  updateAdminSoftware,
  updateAdminSoftwareCategory,
  type SoftwareCategoryItem,
  type SoftwareItem,
  type SoftwareLink
} from '@/request/api'
import {
  adminCreateSoftware,
  adminUploadFile,
  formatFileSize,
  getMarketList,
  platformsOf,
  PLATFORM_LABEL,
  saveOfficialLocally,
  type AdminCreateSoftwarePayload,
  type SoftwarePlatform
} from '@/request/software'
import styles from '../index.module.less'
import localStyles from './index.module.less'

type CategoryForm = {
  name: string
  status: number
  sort: number
}

type SoftwareForm = {
  category_id: number
  name: string
  summary: string
  cover_url: string
  version: string
  links: SoftwareLink[]
  status: number
  sort: number
}

const emptyLink = { label: '', url: '', code: '' }
const MAX_COVER_CHARS = 180 * 1024

function compressCover(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择图片文件'))
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error('图片不能超过 20MB'))
      return
    }
    const objectUrl = URL.createObjectURL(file)
    const image = new window.Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let edge = 1280
      let quality = 0.82
      let data = ''
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const scale = Math.min(1, edge / Math.max(image.width, image.height, 1))
        const width = Math.max(1, Math.round(image.width * scale))
        const height = Math.max(1, Math.round(image.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法处理这张图片'))
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(image, 0, 0, width, height)
        data = canvas.toDataURL('image/jpeg', quality)
        if (data.length <= MAX_COVER_CHARS) {
          resolve(data)
          return
        }
        if (quality > 0.5) quality -= 0.12
        else edge = Math.round(edge * 0.75)
      }
      if (data && data.length <= 400 * 1024) {
        resolve(data)
        return
      }
      reject(new Error('压缩后仍然过大，请换一张图片'))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取这张图片'))
    }
    image.src = objectUrl
  })
}

function saved(res: any) {
  return res?.data?.code === '0' || res?.code === 0
}

function CategoryPanel() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<SoftwareCategoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SoftwareCategoryItem | null>(null)
  const [form] = Form.useForm<CategoryForm>()

  const loadList = async (nextPage = 1) => {
    setLoading(true)
    try {
      const res: any = await getAdminSoftwareCategories({ page: nextPage, page_num: 10 })
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

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({ name: '', status: 1, sort: 0 })
    setOpen(true)
  }

  const openEdit = (row: SoftwareCategoryItem) => {
    setEditing(row)
    form.setFieldsValue({ name: row.name, status: row.status, sort: row.sort })
    setOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const name = values.name.trim()
    if (!name) {
      message.warning('请填写分类名称')
      return
    }
    const res: any = editing?.id
      ? await updateAdminSoftwareCategory({ id: editing.id, name, status: values.status, sort: values.sort })
      : await createAdminSoftwareCategory({ name, status: values.status, sort: values.sort })
    if (saved(res)) {
      message.success(res?.data?.codeMsg || '保存成功')
      setOpen(false)
      loadList(editing ? page : 1)
    }
  }

  const onDelete = async (row: SoftwareCategoryItem) => {
    const res: any = await updateAdminSoftwareCategory({ id: row.id, is_delete: true })
    if (saved(res)) {
      message.success('已删除')
      loadList(page)
    }
  }

  const toggleStatus = async (row: SoftwareCategoryItem) => {
    const res: any = await updateAdminSoftwareCategory({ id: row.id, status: row.status === 1 ? 0 : 1 })
    if (saved(res)) {
      message.success(row.status === 1 ? '已下线' : '已上线')
      loadList(page)
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Button type="primary" onClick={openCreate}>
          新增分类
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={{ current: page, total, pageSize: 10, onChange: (next) => loadList(next) }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '名称', dataIndex: 'name' },
          { title: '排序', dataIndex: 'sort', width: 90 },
          {
            title: '状态',
            width: 100,
            render: (_: unknown, row: SoftwareCategoryItem) =>
              row.status === 1 ? <Tag color="green">上线</Tag> : <Tag color="red">下线</Tag>
          },
          { title: '更新时间', dataIndex: 'update_time', width: 180 },
          {
            title: '操作',
            width: 220,
            render: (_: unknown, row: SoftwareCategoryItem) => (
              <>
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Button type="link" onClick={() => toggleStatus(row)}>
                  {row.status === 1 ? '下线' : '上线'}
                </Button>
                <Button type="link" danger onClick={() => onDelete(row)}>
                  删除
                </Button>
              </>
            )
          }
        ]}
      />
      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={open}
        onOk={onSubmit}
        onCancel={() => setOpen(false)}
        destroyOnClose
        okText="保存"
      >
        <Form form={form} layout="vertical" initialValues={{ status: 1, sort: 0 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input maxLength={50} placeholder="例如：办公软件" />
          </Form.Item>
          <Form.Item label="排序" name="sort" extra="数字越大越靠前">
            <InputNumber min={0} max={999999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group>
              <Radio.Button value={1}>上线</Radio.Button>
              <Radio.Button value={0}>下线</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function SoftwarePanel() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<SoftwareItem[]>([])
  const [categories, setCategories] = useState<SoftwareCategoryItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SoftwareItem | null>(null)
  const [form] = Form.useForm<SoftwareForm>()
  const [compressing, setCompressing] = useState(false)
  const coverUrl = Form.useWatch('cover_url', form) || ''

  const loadCategories = async () => {
    const res: any = await getAdminSoftwareCategories({ page: 1, page_num: 200 })
    setCategories(res?.data?.list || [])
  }

  const loadList = async (nextPage = 1) => {
    setLoading(true)
    try {
      const res: any = await getAdminSoftware({ page: nextPage, page_num: 10 })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
    loadList(1)
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.setFieldsValue({
      category_id: categories[0]?.id,
      name: '',
      summary: '',
      cover_url: '',
      version: '',
      links: [{ ...emptyLink }],
      status: 1,
      sort: 0
    })
    setOpen(true)
  }

  const openEdit = (row: SoftwareItem) => {
    setEditing(row)
    form.setFieldsValue({
      category_id: row.category_id,
      name: row.name,
      summary: row.summary,
      cover_url: row.cover_url,
      version: row.version,
      links: row.links?.length ? row.links : [{ ...emptyLink }],
      status: row.status,
      sort: row.sort
    })
    /* 2026-10-25 多平台护栏（站长验收发现）：
       本页签的表单只认识 links（老结构），而「管理员直传」写进去的软件带 platforms 数组。
       若在这里编辑再保存，只提交 links 会被后端理解成「其它平台的包删了」。
       现在编辑多平台软件时明确告知去哪里改平台，避免误覆盖。 */
    const rowPlatforms = (row as any).platforms as unknown[] | undefined
    if (rowPlatforms && rowPlatforms.length > 1) {
      message.info(
        `这个软件有 ${rowPlatforms.length} 个平台。本页只改名称/简介/分类等通用信息；要增删平台或换安装包，请到「管理员直传」页签重新提交。`,
        6
      )
    }
    setOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const links = (values.links || [])
      .map((item) => ({
        label: (item.label || '').trim(),
        url: (item.url || '').trim(),
        code: (item.code || '').trim()
      }))
      .filter((item) => item.label || item.url || item.code)
    if (!links.length) {
      message.warning('请至少填写一条下载链接')
      return
    }
    const payload = {
      category_id: values.category_id,
      name: values.name.trim(),
      summary: (values.summary || '').trim(),
      cover_url: (values.cover_url || '').trim(),
      version: (values.version || '').trim(),
      links,
      status: values.status,
      sort: values.sort
    }
    const res: any = editing?.id
      ? await updateAdminSoftware({ id: editing.id, ...payload })
      : await createAdminSoftware(payload)
    if (saved(res)) {
      message.success(res?.data?.codeMsg || '保存成功')
      setOpen(false)
      loadList(editing ? page : 1)
    }
  }

  const onDelete = async (row: SoftwareItem) => {
    const res: any = await updateAdminSoftware({ id: row.id, is_delete: true })
    if (saved(res)) {
      message.success('已删除')
      loadList(page)
    }
  }

  const toggleStatus = async (row: SoftwareItem) => {
    const res: any = await updateAdminSoftware({ id: row.id, status: row.status === 1 ? 0 : 1 })
    if (saved(res)) {
      message.success(row.status === 1 ? '已下线' : '已上线')
      loadList(page)
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Button type="primary" onClick={openCreate} disabled={!categories.length}>
          新增软件
        </Button>
        {!categories.length ? <span>请先新增分类</span> : null}
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        scroll={{ x: 1100 }}
        pagination={{ current: page, total, pageSize: 10, onChange: (next) => loadList(next) }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 70 },
          {
            title: '封面',
            width: 80,
            render: (_: unknown, row: SoftwareItem) =>
              row.cover_url ? (
                <img
                  src={row.cover_url}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'contain',
                    /* 2026-10-25 深色修复：原来写死 #eef2f7，深色下是一块亮白底，很刺眼 */
                    background: 'var(--surface-sunken)',
                    borderRadius: 6
                  }}
                />
              ) : (
                '-'
              )
          },
          { title: '名称', dataIndex: 'name', width: 160 },
          { title: '分类', dataIndex: 'category_name', width: 120 },
          { title: '版本', dataIndex: 'version', width: 100 },
          { title: '简介', dataIndex: 'summary', ellipsis: true },
          {
            title: '链接',
            width: 80,
            render: (_: unknown, row: SoftwareItem) => row.links?.length || 0
          },
          { title: '排序', dataIndex: 'sort', width: 80 },
          {
            title: '状态',
            width: 90,
            render: (_: unknown, row: SoftwareItem) =>
              row.status === 1 ? <Tag color="green">上线</Tag> : <Tag color="red">下线</Tag>
          },
          {
            title: '操作',
            width: 220,
            fixed: 'right',
            render: (_: unknown, row: SoftwareItem) => (
              <>
                <Button type="link" onClick={() => openEdit(row)}>
                  编辑
                </Button>
                <Button type="link" onClick={() => toggleStatus(row)}>
                  {row.status === 1 ? '下线' : '上线'}
                </Button>
                <Button type="link" danger onClick={() => onDelete(row)}>
                  删除
                </Button>
              </>
            )
          }
        ]}
      />
      <Modal
        title={editing ? '编辑软件' : '新增软件'}
        open={open}
        onOk={onSubmit}
        onCancel={() => setOpen(false)}
        destroyOnClose
        width={720}
        okText="保存"
      >
        <Form form={form} layout="vertical" initialValues={{ status: 1, sort: 0, links: [{ ...emptyLink }] }}>
          <Form.Item label="分类" name="category_id" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              placeholder="选择分类"
              options={categories.map((item) => ({
                value: item.id,
                label: item.status === 1 ? item.name : `${item.name}（已下线）`
              }))}
            />
          </Form.Item>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入软件名称' }]}>
            <Input maxLength={200} placeholder="软件名称" />
          </Form.Item>
          <Form.Item label="简介" name="summary" extra="前台关键字会搜索名称和这段简介">
            <Input.TextArea rows={4} maxLength={5000} showCount placeholder="软件简介" />
          </Form.Item>
          <Form.Item label="封面" extra="上传本地图片会自动压缩。也可以粘贴 http 或 https 图片地址，可留空">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={async (file) => {
                  setCompressing(true)
                  try {
                    const dataUrl = await compressCover(file)
                    form.setFieldValue('cover_url', dataUrl)
                    message.success('图片已压缩')
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : '图片处理失败')
                  } finally {
                    setCompressing(false)
                  }
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={compressing}>
                  上传本地图片
                </Button>
              </Upload>
              <Input
                maxLength={500}
                allowClear
                placeholder="https://example.com/cover.png"
                value={coverUrl.startsWith('http://') || coverUrl.startsWith('https://') ? coverUrl : ''}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value && coverUrl.startsWith('data:')) return
                  form.setFieldValue('cover_url', value)
                }}
              />
              {coverUrl ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                    /* 2026-10-25 深色修复：同上，亮白底换成随主题走的浅底 */
                    background: 'var(--surface-sunken)',
                    borderRadius: 8
                  }}
                >
                  <img
                    src={coverUrl}
                    alt=""
                    style={{ maxWidth: '100%', maxHeight: 280, width: 'auto', height: 'auto', objectFit: 'contain' }}
                  />
                </div>
              ) : null}
              {coverUrl ? (
                <Button type="link" style={{ padding: 0 }} onClick={() => form.setFieldValue('cover_url', '')}>
                  移除封面
                </Button>
              ) : null}
            </Space>
          </Form.Item>
          <Form.Item name="cover_url" hidden>
            <Input />
          </Form.Item>
          <Form.Item label="版本" name="version">
            <Input maxLength={50} placeholder="例如 1.2.0" />
          </Form.Item>
          <Form.List name="links">
            {(fields, { add, remove }) => (
              <div>
                <div style={{ marginBottom: 8 }}>下载链接</div>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      {...restField}
                      name={[name, 'label']}
                      rules={[{ required: true, message: '名称' }]}
                    >
                      <Input placeholder="百度网盘" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'url']}
                      rules={[{ required: true, message: '链接' }]}
                    >
                      <Input placeholder="https://pan.baidu.com/..." style={{ width: 280 }} />
                    </Form.Item>
                    <Form.Item {...restField} name={[name, 'code']}>
                      <Input placeholder="提取码" style={{ width: 100 }} />
                    </Form.Item>
                    {fields.length > 1 ? <MinusCircleOutlined onClick={() => remove(name)} /> : null}
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add({ ...emptyLink })} icon={<PlusOutlined />} block>
                  添加链接
                </Button>
              </div>
            )}
          </Form.List>
          <Form.Item label="排序" name="sort" extra="数字越大越靠前" style={{ marginTop: 16 }}>
            <InputNumber min={0} max={999999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status">
            <Radio.Group>
              <Radio.Button value={1}>上线</Radio.Button>
              <Radio.Button value={0}>下线</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


type DirectForm = {
  category_id: number
  name: string
  summary: string
  /**
   * 勾选的平台数组（Checkbox.Group 直接存 string[]）。
   * 为什么不把链接塞进同一个数组里：站长要「切勾选时已填链接不丢」，
   * 若用 Form.List + 动态 name 路径，取消勾选再勾回来字段值会被 antd 清掉，
   * 所以链接拆成下面三个独立的固定字段，勾选只控制「提交哪些、显示哪些」。
   */
  platforms: SoftwarePlatform[]
  url_windows?: string
  url_macos?: string
  url_linux?: string
  version: string
  changelog: string
  sort: number
}

const PLATFORM_OPTIONS: { value: SoftwarePlatform; label: string }[] = [
  { value: 'windows', label: PLATFORM_LABEL.windows },
  { value: 'macos', label: PLATFORM_LABEL.macos },
  { value: 'linux', label: PLATFORM_LABEL.linux }
]

const MAX_PACKAGE = 200 * 1024 * 1024

/** 平台 → 表单里链接字段名，集中一处避免拼错 */
const URL_FIELD: Record<SoftwarePlatform, 'url_windows' | 'url_macos' | 'url_linux'> = {
  windows: 'url_windows',
  macos: 'url_macos',
  linux: 'url_linux'
}

/** 上传模式下每个平台各自的安装包状态：文件名 / 体积 / 上传后拿到的直链 */
type PlatformPackage = { name: string; size: number; url?: string }

/**
 * 在分类列表里认出「AI(Agent)软件」
 * ------------------------------------------------------------
 * 为什么按名字模糊匹配、不写死 id：分类是后端自增的，
 * 换环境/重建库 id 就会变（现有数据里效率软件恰好是 id=3，AI 是 id=1）。
 * 只认名字里的 "AI"，既覆盖「AI(Agent)软件」，也覆盖以后改名的「AI 工具」等写法。
 */
function pickAgentCategory(rows: SoftwareCategoryItem[]): SoftwareCategoryItem | undefined {
  return rows.find((item) => /AI\s*\(?\s*Agent/i.test(item.name) || /^\s*AI/i.test(item.name))
}

/**
 * 管理员直传 · 多平台版
 * ------------------------------------------------------------
 * 站长原话：「我上传链接的话就是三个平台同时都能在一个链接下载」。
 * 所以这里做三件事：
 *   1. 平台用 Checkbox.Group 多选，勾几个就上架几个平台；
 *   2. 每个平台一条独立链接（切勾选不丢已填内容）；
 *   3. 提供「同一链接用于全部平台」一键填充，一次贴完三个平台。
 *
 * 提交时再拼成 platforms 数组，并保留第一条到单数字段，
 * 兼容后端「先按单平台实现」的过渡期。
 *
 * 接口没上线时：文件上传会失败，提示改用链接；表单提交失败则写本机暂存并提示本地模式。
 */
function DirectUploadPanel() {
  const [categories, setCategories] = useState<SoftwareCategoryItem[]>([])
  const [form] = Form.useForm<DirectForm>()
  const [saving, setSaving] = useState(false)
  /**
   * 上传模式：每个平台各一份文件状态
   * ------------------------------------------------------------
   * 为什么不是「一个包管三个平台」：三个平台的安装包文件名、体积、
   * 甚至构建产物都不同（.exe / .dmg / .AppImage），只能各自拖各自的。
   * key 用平台名，勾选变化时已选文件仍然保留（和链接字段同一思路）。
   */
  const [uploading, setUploading] = useState<Partial<Record<SoftwarePlatform, boolean>>>({})
  const [mode, setMode] = useState<'file' | 'link'>('link')
  const [files, setFiles] = useState<Partial<Record<SoftwarePlatform, PlatformPackage>>>({})
  const [coverUrl, setCoverUrl] = useState('')
  const [compressing, setCompressing] = useState(false)
  /** 一键填充用的临时输入框，不参与表单提交 */
  const [bulkUrl, setBulkUrl] = useState('')

  const selectedPlatforms: SoftwarePlatform[] = Form.useWatch('platforms', form) || []
  /** 任一平台正在上传：用于禁用/转圈提交按钮（uploading 是对象，不能直接当布尔值） */
  const anyUploading = Object.values(uploading).some(Boolean)

  const loadCategories = async () => {
    const res: any = await getAdminSoftwareCategories({ page: 1, page_num: 200 })
    const rows = (res?.data?.list || []) as SoftwareCategoryItem[]
    setCategories(rows)
    /**
     * 默认选中 AI(Agent) 软件
     * ------------------------------------------------------------
     * 2026-10-25 站长反馈：他新传的软件落进了「效率软件」，
     * 导致接入指南取不到它（接入指南只认 AI(Agent) 分类）。
     * 常见原因是下拉默认空着，顺手没选就提交了。
     * 这里在分类加载完后，若**表单还没选分类**就自动选中 AI(Agent) —— 只是省一次手动选择，
     * 并不会覆盖管理员的明确选择（已有值就不动）。
     */
    const current = form.getFieldValue('category_id')
    if (current === undefined || current === null) {
      const preferred = pickAgentCategory(rows)
      if (preferred) form.setFieldValue('category_id', preferred.id)
    }
  }

  useEffect(() => {
    void loadCategories()
  }, [])

  /** 一键填充：把同一个链接写进所有已勾选平台 */
  const applyBulkUrl = () => {
    const url = bulkUrl.trim()
    if (!url) {
      message.warning('先粘贴一个下载链接')
      return
    }
    if (!selectedPlatforms.length) {
      message.warning('先勾选至少一个平台')
      return
    }
    selectedPlatforms.forEach((platform) => {
      form.setFieldValue(URL_FIELD[platform], url)
    })
    message.success(`已填入 ${selectedPlatforms.length} 个平台`)
  }

  /**
   * 某个平台选文件 → 调上传接口
   * ------------------------------------------------------------
   * 只把结果记到这个平台名下，不再顺手填到别的平台：
   *   · 各平台包本来就不同，乱填会让 macOS 的下载按钮指向 exe；
   *   · 三个平台都想用同一条链接时，走「填链接」模式的一键填充。
   * 失败也不假装成功，明确提示可改用链接。
   */
  const onPickPackage = async (platform: SoftwarePlatform, file: File) => {
    if (file.size > MAX_PACKAGE) {
      message.error('安装包不能超过 200MB')
      return
    }
    setUploading((prev) => ({ ...prev, [platform]: true }))
    // 先把文件名/体积显示出来，让管理员确认选的是哪个包
    setFiles((prev) => ({ ...prev, [platform]: { name: file.name, size: file.size } }))
    try {
      const res = await adminUploadFile(file, 'package')
      if (res.ok && res.url) {
        setFiles((prev) => ({
          ...prev,
          [platform]: { name: file.name, size: file.size, url: res.url }
        }))
        message.success(`${PLATFORM_LABEL[platform]} 安装包已上传`)
      } else {
        message.warning(`${PLATFORM_LABEL[platform]} 上传接口未就绪，可先用「填链接」方式提交`)
      }
    } finally {
      setUploading((prev) => ({ ...prev, [platform]: false }))
    }
  }

  /** 移除某平台已选文件（选错了重选） */
  const clearPlatformFile = (platform: SoftwarePlatform) => {
    setFiles((prev) => {
      const next = { ...prev }
      delete next[platform]
      return next
    })
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const chosen: SoftwarePlatform[] = values.platforms || []

    if (!chosen.length) {
      message.warning('至少选一个平台')
      return
    }

    /**
     * 逐平台取「下载地址 + 体积」：两种模式来源不同
     *   · 上传安装包：地址和体积都来自该平台自己的上传结果；
     *   · 填链接：地址来自 url_windows/url_macos/url_linux，体积未知（不下发，避免后端当 0）。
     */
    const platforms = chosen.map((platform) => ({
      platform,
      file_url:
        mode === 'file'
          ? files[platform]?.url || ''
          : (values[URL_FIELD[platform]] || '').trim(),
      file_size: mode === 'file' ? files[platform]?.size : undefined
    }))

    const missing = platforms.filter((item) => !item.file_url)
    if (missing.length) {
      const names = missing.map((m) => PLATFORM_LABEL[m.platform]).join('、')
      message.warning(
        mode === 'file' ? `${names} 的安装包还没上传成功` : `这些平台还没填链接：${names}`
      )
      return
    }

    setSaving(true)
    try {
      const primary = platforms[0]
      const payload = {
        category_id: values.category_id,
        name: values.name.trim(),
        summary: (values.summary || '').trim(),
        cover_url: coverUrl,
        // 多平台新字段：一个平台一条，后端按数组存进 software_release
        platforms,
        version: (values.version || '').trim(),
        /**
         * 单数字段兼容（后端过渡期）
         * ------------------------------------------------------------
         * 老后端只认 platform / file_url / file_size 这三个单数字段。
         * 所以「只挂一个平台」时把它们一起下发，新旧后端都能读懂；
         * 多平台时**故意不下发**——否则后端把 primary 当成唯一平台，
         * 另外两个平台会被静默丢掉，而前端还显示上架成功，这才是真事故。
         */
        ...(platforms.length === 1
          ? {
              platform: primary.platform,
              file_url: primary.file_url,
              file_size: primary.file_size
            }
          : {}),
        changelog: (values.changelog || '').trim(),
        links: platforms.map((item) => ({
          label: PLATFORM_LABEL[item.platform],
          url: item.file_url
        })),
        status: 1,
        sort: values.sort ?? 0
      }
      const res = await adminCreateSoftware(payload as any)
      if (res.ok) {
        /* 2026-10-25 站长确认：后端 `software` 目前是**单平台**表结构。
           这意味着勾了 3 个平台提交时，后端很可能只存下 1 个平台，
           而接口照样返回成功。如果这时直接提示「3 个平台已上架」，
           站长会以为好了，实际商城里只有一个平台能下 —— 这是最坑的一种「假成功」。
           所以提交成功后回读一次商城，用**实际存进去的平台数**来提示。 */
        let savedCount = platforms.length
        let verified = false
        try {
          const after = await getMarketList({ source: 'official', page_num: 100 })
          if (!after.local) {
            const hit = after.list.find((item) => item.name === payload.name)
            if (hit) {
              const got = platformsOf(hit)
              savedCount = got.length
              verified = true
            }
          }
        } catch {
          // 回读失败不影响主流程，按乐观值提示
        }
        if (verified && savedCount < platforms.length) {
          message.warning(
            `注意：你勾了 ${platforms.length} 个平台，但后端只存下了 ${savedCount} 个（当前 software 表是单平台结构）。` +
              `其它平台没有保存成功，需要后端升级为多平台表后才能一次上架多个平台。`,
            10
          )
        } else {
          message.success(
            platforms.length > 1
              ? `已上架：${platforms.length} 个平台在商城里立即可见`
              : '已上架：官方软件在商城里立即可见'
          )
        }
        resetForm()
        setFiles({})
        setCoverUrl('')
        setBulkUrl('')
        return
      }
      // 接口没上线：写本机暂存，让本地也能看到刚传的软件
      const local = await saveOfficialLocally({
        id: `local-${Date.now()}`,
        name: payload.name,
        summary: payload.summary,
        category_id: payload.category_id,
        cover_url: payload.cover_url,
        platforms: platforms.map((item) => ({
          platform: item.platform,
          file_url: item.file_url,
          file_size: item.file_size
        })),
        // 单数字段只在单平台时写，理由同上：多平台写了反而会被旧页面误读成「只有一个平台」
        ...(platforms.length === 1
          ? {
              platform: primary.platform,
              file_url: primary.file_url,
              file_size: primary.file_size
            }
          : {}),
        version: payload.version,
        changelog: payload.changelog,
        source: 'official',
        author_name: '站长',
        review_status: 'approved',
        status: 1,
        sort: payload.sort,
        insert_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      })
      if (local.ok) {
        message.warning('本地模式：官方直传接口未接入，这条只存在于这台浏览器')
        resetForm()
        setFiles({})
        setCoverUrl('')
        setBulkUrl('')
      }
    } finally {
      setSaving(false)
    }
  }

  /** 重置表单并把默认分类重新套上：连续上传时不用每次再选一遍 */
  const resetForm = () => {
    form.resetFields()
    const preferred = pickAgentCategory(categories)
    if (preferred) form.setFieldValue('category_id', preferred.id)
  }

  return (
    <div>
      <div className={localStyles.panelHint}>
        <CloudUploadOutlined />
        <span>
          管理员直传：提交<strong>立即上架</strong>（source=official，不经过审核）。
          平台可多选，同一个链接能一键填满三个平台；用户投稿请走「用户审核」页签。
        </span>
      </div>

      <div className={localStyles.modeSwitch} role="tablist" aria-label="录入方式">
        <button
          type="button"
          className={[localStyles.modeBtn, mode === 'link' ? localStyles.modeBtnActive : ''].join(' ')}
          onClick={() => setMode('link')}
        >
          填链接
        </button>
        <button
          type="button"
          className={[localStyles.modeBtn, mode === 'file' ? localStyles.modeBtnActive : ''].join(' ')}
          onClick={() => setMode('file')}
        >
          上传安装包
        </button>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{ platforms: ['windows', 'macos', 'linux'], sort: 0 }}
      >
        <div className={localStyles.formGrid}>
          <Form.Item label="分类" name="category_id" rules={[{ required: true, message: '请选择分类' }]}>
            <Select
              placeholder={categories.length ? '选择分类' : '请先在「分类」页签新增分类'}
              options={categories.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item label="版本" name="version" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input maxLength={50} placeholder="例如 1.0.0" />
          </Form.Item>
          <Form.Item label="软件名称" name="name" rules={[{ required: true, message: '请输入软件名称' }]}>
            <Input maxLength={100} placeholder="例如：余额查询助手" />
          </Form.Item>
          <Form.Item
            label="适用平台"
            name="platforms"
            rules={[{ required: true, message: '至少勾选一个平台' }]}
            extra="勾几个就上架几个平台"
          >
            <Checkbox.Group options={PLATFORM_OPTIONS} />
          </Form.Item>
        </div>

        <Form.Item label="简介" name="summary" rules={[{ required: true, message: '用一句话说清它做什么' }]}>
          <Input.TextArea rows={3} maxLength={2000} showCount placeholder="商城列表里显示的一句话简介" />
        </Form.Item>

        {mode === 'file' ? (
          /**
           * 上传安装包：每个勾选的平台各占一行、各拖一个包
           * ------------------------------------------------------------
           * 为什么不做「一个包一键填满三个平台」：
           *   Windows 是 .exe、macOS 是 .dmg、Linux 是 .AppImage，本来就不是同一个文件，
           *   体积也不同；硬共用一个包会让 mac 用户下到 exe。
           *   三平台确实共用一条外链的场景，请走「填链接」模式的一键填充。
           */
          <div className={localStyles.platformBlock}>
            <div className={localStyles.platformBlockHead}>
              <span className={localStyles.platformBlockTitle}>安装包</span>
              <span className={localStyles.platformBlockHint}>
                每个平台各拖一个包，单个不超过 200MB；上传成功后各自显示文件名与体积
              </span>
            </div>
            {selectedPlatforms.length ? (
              selectedPlatforms.map((platform) => {
                const current = files[platform]
                const isUploading = Boolean(uploading[platform])
                return (
                  <div key={platform} className={localStyles.platformRow}>
                    <span className={localStyles.platformName}>{PLATFORM_LABEL[platform]}</span>
                    <div className={localStyles.platformSlot}>
                      <Upload.Dragger
                        accept=".zip,.dmg,.exe,.msi,.deb,.rpm,.tar.gz,.7z,.rar,.AppImage,.pkg"
                        showUploadList={false}
                        disabled={isUploading}
                        beforeUpload={(file) => {
                          void onPickPackage(platform, file as File)
                          return false
                        }}
                        className={localStyles.compactDragger}
                      >
                        <p className={localStyles.dropTitle}>
                          {isUploading
                            ? '上传中…'
                            : current
                              ? '点这里换一个包'
                              : `点这里或把 ${PLATFORM_LABEL[platform]} 安装包拖进来`}
                        </p>
                      </Upload.Dragger>
                      {current ? (
                        <div className={localStyles.filePicked}>
                          <span className={localStyles.filePickedName} title={current.name}>
                            {current.name}
                          </span>
                          <span className={localStyles.filePickedSize}>
                            {formatFileSize(current.size)}
                            {current.url ? ' · 已上传' : ' · 未上传'}
                          </span>
                          <button
                            type="button"
                            className={localStyles.fileClear}
                            onClick={() => clearPlatformFile(platform)}
                            aria-label={`移除 ${PLATFORM_LABEL[platform]} 的安装包`}
                          >
                            移除
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })
            ) : (
              <p className={localStyles.bulkHint}>请先勾选上方「适用平台」。</p>
            )}
          </div>
        ) : (
          /* 填链接：每个勾选平台一行；三平台同一个包时，用上面的一键填充省事 */
          <>
            <div className={localStyles.bulkRow}>
              <Input
                allowClear
                value={bulkUrl}
                placeholder="三个平台用同一个下载链接？粘贴到这里"
                aria-label="三个平台共用的下载链接"
                onChange={(event) => setBulkUrl(event.target.value)}
                onPressEnter={applyBulkUrl}
              />
              <Button onClick={applyBulkUrl}>同一链接用于全部平台</Button>
            </div>
            <p className={localStyles.bulkHint}>
              一键填充会把这条链接写进所有已勾选平台；只想某个平台单独给包，就只改那一行。不勾的平台不会出现在提交里。
            </p>

            {selectedPlatforms.length ? (
              selectedPlatforms.map((platform) => (
                <Form.Item
                  key={platform}
                  label={`${PLATFORM_LABEL[platform]} 安装包链接`}
                  name={URL_FIELD[platform]}
                  rules={[{ required: true, message: `请填写 ${PLATFORM_LABEL[platform]} 的链接` }]}
                >
                  <Input placeholder="https://..." />
                </Form.Item>
              ))
            ) : (
              <p className={localStyles.bulkHint}>请先勾选上方「适用平台」。</p>
            )}
          </>
        )}

        <Form.Item label="封面（选填）" extra="上传本地图片会自动压缩；不传则用默认样式">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={async (file) => {
                setCompressing(true)
                try {
                  const dataUrl = await compressCover(file as File)
                  setCoverUrl(dataUrl)
                  message.success('封面已压缩')
                } catch (error) {
                  message.error(error instanceof Error ? error.message : '图片处理失败')
                } finally {
                  setCompressing(false)
                }
                return false
              }}
            >
              <Button icon={<UploadOutlined />} loading={compressing}>
                上传封面
              </Button>
            </Upload>
            {coverUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={coverUrl}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border-soft)' }}
                />
                <Button type="link" style={{ padding: 0 }} onClick={() => setCoverUrl('')}>
                  移除封面
                </Button>
              </div>
            ) : null}
          </Space>
        </Form.Item>

        <Form.Item label="更新说明" name="changelog">
          <Input.TextArea rows={3} maxLength={1000} showCount placeholder="这一版改了什么、有什么注意事项" />
        </Form.Item>

        <Form.Item label="排序" name="sort" extra="数字越大越靠前">
          <InputNumber min={0} max={999999} style={{ width: '100%' }} />
        </Form.Item>

        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          loading={saving || anyUploading}
          onClick={() => void onSubmit()}
          disabled={!categories.length}
        >
          提交并上架
        </Button>
        {!categories.length ? <span style={{ marginLeft: 12 }}>请先新增分类</span> : null}
      </Form>
    </div>
  )
}

function AdminSoftware() {
  /* 2026-10-25 站长验收反馈：分类下拉里只有一个「AI(Agent)软件」。
     查了线上接口，数据库确实只有这 1 条分类（不是前端 bug）。
     但存在一个真实缺陷：分类只在页面挂载时加载一次，
     在「分类」页签新增完再切到「管理员直传」，下拉里还是旧的空/少分类，
     必须手动刷新整页才出现。这里改成切页签就重新挂载子面板，
     保证「新增分类 → 切过去立刻能选」。 */
  const [activeKey, setActiveKey] = useState('category')
  return (
    <Tabs
      activeKey={activeKey}
      onChange={setActiveKey}
      destroyInactiveTabPane
      items={[
        { key: 'category', label: '分类', children: <CategoryPanel /> },
        { key: 'software', label: '软件', children: <SoftwarePanel /> },
        { key: 'direct', label: '管理员直传', children: <DirectUploadPanel /> }
      ]}
    />
  )
}

export default AdminSoftware
