import { useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Radio, Table, Tag, message } from 'antd'
import {
  createAdminAnnouncement,
  getAdminAnnouncement,
  updateAdminAnnouncement,
  type AnnouncementItem
} from '@/request/api'
import styles from '../index.module.less'

type FormValues = {
  title: string
  content: string
  status: number
  sort: number
}

function AdminAnnouncement() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<AnnouncementItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AnnouncementItem | null>(null)
  const [form] = Form.useForm<FormValues>()

  const loadList = async (nextPage = 1) => {
    setLoading(true)
    try {
      const res: any = await getAdminAnnouncement({ page: nextPage, page_num: 10 })
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
    form.setFieldsValue({ title: '', content: '', status: 1, sort: 0 })
    setOpen(true)
  }

  const openEdit = (row: AnnouncementItem) => {
    setEditing(row)
    form.setFieldsValue({
      title: row.title,
      content: row.content,
      status: row.status,
      sort: row.sort
    })
    setOpen(true)
  }

  const onSubmit = async () => {
    const values = await form.validateFields()
    const title = values.title.trim()
    const content = values.content.trim()
    if (!title || !content) {
      message.warning('请填写标题和内容')
      return
    }
    let res: any
    if (editing?.id) {
      res = await updateAdminAnnouncement({
        id: editing.id,
        title,
        content,
        status: values.status,
        sort: values.sort
      })
    } else {
      res = await createAdminAnnouncement({
        title,
        content,
        status: values.status,
        sort: values.sort
      })
    }
    if (res?.data?.code === '0' || res?.code === 0) {
      message.success(res?.data?.codeMsg || '保存成功')
      setOpen(false)
      loadList(editing ? page : 1)
    }
  }

  const onDelete = async (row: AnnouncementItem) => {
    const res: any = await updateAdminAnnouncement({ id: row.id, is_delete: true })
    if (res?.data?.code === '0' || res?.code === 0) {
      message.success('已删除')
      loadList(page)
    }
  }

  const toggleStatus = async (row: AnnouncementItem) => {
    const res: any = await updateAdminAnnouncement({
      id: row.id,
      status: row.status === 1 ? 0 : 1
    })
    if (res?.data?.code === '0' || res?.code === 0) {
      message.success(row.status === 1 ? '已下线' : '已上线')
      loadList(page)
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Button type="primary" onClick={openCreate}>
          新增公告
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        pagination={{
          current: page,
          total,
          pageSize: 10,
          onChange: (next) => loadList(next)
        }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '标题', dataIndex: 'title', width: 200 },
          {
            title: '内容',
            dataIndex: 'content',
            ellipsis: true
          },
          { title: '排序', dataIndex: 'sort', width: 90 },
          {
            title: '状态',
            width: 100,
            render: (_: unknown, row: AnnouncementItem) =>
              row.status === 1 ? <Tag color="green">上线</Tag> : <Tag color="red">下线</Tag>
          },
          { title: '创建时间', dataIndex: 'insert_time', width: 180 },
          { title: '更新时间', dataIndex: 'update_time', width: 180 },
          {
            title: '操作',
            width: 220,
            render: (_: unknown, row: AnnouncementItem) => (
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
        title={editing ? '编辑公告' : '新增公告'}
        open={open}
        onOk={onSubmit}
        onCancel={() => setOpen(false)}
        destroyOnClose
        width={640}
        okText="保存"
      >
        <Form form={form} layout="vertical" initialValues={{ status: 1, sort: 0 }}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={200} placeholder="公告标题" />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <Input.TextArea rows={8} maxLength={20000} showCount placeholder="公告正文，支持多行" />
          </Form.Item>
          <Form.Item label="排序" name="sort" extra="数字越大越靠前；同级按创建时间倒序">
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

export default AdminAnnouncement
