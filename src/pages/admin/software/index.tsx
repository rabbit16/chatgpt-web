import { useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Radio, Select, Space, Table, Tabs, Tag, Upload, message } from 'antd'
import { MinusCircleOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
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
import styles from '../index.module.less'

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
                    background: '#eef2f7',
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
                    background: '#eef2f7',
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

function AdminSoftware() {
  return (
    <Tabs
      items={[
        { key: 'category', label: '分类', children: <CategoryPanel /> },
        { key: 'software', label: '软件', children: <SoftwarePanel /> }
      ]}
    />
  )
}

export default AdminSoftware
