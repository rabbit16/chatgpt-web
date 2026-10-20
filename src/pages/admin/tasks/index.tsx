import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Input, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { CheckOutlined, DeleteOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import {
  completeAllTasks,
  deleteDoneTasks,
  deleteTask,
  getTaskList,
  reevaluateTask,
  updateTaskStatus,
  type TaskCounts,
  type TaskItem,
  type TaskScope,
  type TaskStatus
} from '@/request/api'

const PAGE_SIZE = 50

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  running: { label: '进行中', color: 'processing' },
  failed: { label: '失败', color: 'error' },
  done: { label: '已完成', color: 'success' }
}

const STATUS_OPTIONS = (Object.keys(STATUS_META) as TaskStatus[]).map((value) => ({
  value,
  label: STATUS_META[value].label
}))

const FILTERS: Array<{ value: TaskScope; label: string }> = [
  { value: 'running', label: '进行中' },
  { value: 'failed', label: '失败' },
  { value: 'open', label: '未完成' },
  { value: 'done', label: '已完成' },
  { value: 'all', label: '全部' }
]

const EMPTY_COUNTS: TaskCounts = { open: 0, all: 0, running: 0, failed: 0, done: 0 }

function AdminTasks() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<TaskScope>('running')
  const [account, setAccount] = useState('')
  const [appliedAccount, setAppliedAccount] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [list, setList] = useState<TaskItem[]>([])
  const [counts, setCounts] = useState<TaskCounts>(EMPTY_COUNTS)

  const loadList = useCallback(async (nextScope = scope, nextPage = 1, nextAccount = appliedAccount) => {
    setLoading(true)
    setError('')
    try {
      const data = await getTaskList({
        scope: nextScope,
        account: nextAccount || undefined,
        limit: PAGE_SIZE,
        offset: (nextPage - 1) * PAGE_SIZE
      })
      setList(data.items || [])
      setTotal(Number(data.total || 0))
      setPage(nextPage)
      setCounts({ ...EMPTY_COUNTS, ...(data.counts || {}) })
    } catch (err) {
      setList([])
      setError(err instanceof Error ? err.message : '读取任务失败')
    } finally {
      setLoading(false)
    }
  }, [appliedAccount, scope])

  useEffect(() => {
    void loadList(scope, 1, appliedAccount)
  }, [loadList, scope, appliedAccount])

  async function onStatus(row: TaskItem, status: TaskStatus) {
    if (status === row.status) return
    try {
      await updateTaskStatus({ id: row.id, status })
      message.success('状态已更新')
      await loadList(scope, page, appliedAccount)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败')
    }
  }

  return (
    <div>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 16 }}
        message="任务来自中转访问日志"
        description="Claude 的 tool_use，以及 OpenAI 输出里的 function_call，表示任务还在进行。没有待执行工具的 end_turn、stop、completed 才表示已完成。HTTP 失败或 result 为 error、incomplete 表示失败。同一会话里连续的工具调用会归到同一个任务。"
      />
      {error ? <Alert showIcon type="warning" style={{ marginBottom: 16 }} message={error} /> : null}
      <Space wrap style={{ marginBottom: 16 }}>
        {FILTERS.map((item) => (
          <Button key={item.value} type={scope === item.value ? 'primary' : 'default'} onClick={() => setScope(item.value)}>
            {item.label}
            {item.value === 'running' ? ` ${counts.running}` : ''}
            {item.value === 'failed' ? ` ${counts.failed}` : ''}
            {item.value === 'done' ? ` ${counts.done}` : ''}
          </Button>
        ))}
        <Input
          allowClear
          placeholder="手机号"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          onPressEnter={() => setAppliedAccount(account.trim())}
          style={{ width: 180 }}
        />
        <Button icon={<SearchOutlined />} onClick={() => setAppliedAccount(account.trim())}>
          筛选
        </Button>
        <Popconfirm
          title="把当前筛选下所有进行中的任务标成完成？"
          okText="全部完成"
          cancelText="取消"
          onConfirm={async () => {
            const data = await completeAllTasks(appliedAccount || undefined)
            message.success(`已完成 ${data.updated} 个任务`)
            await loadList(scope, 1, appliedAccount)
          }}
        >
          <Button icon={<CheckOutlined />} disabled={counts.running === 0}>
            一键全部完成
          </Button>
        </Popconfirm>
        <Popconfirm
          title="删除当前筛选下的已完成任务？"
          okText="删除"
          cancelText="取消"
          onConfirm={async () => {
            const data = await deleteDoneTasks(appliedAccount || undefined)
            message.success(`已删除 ${data.deleted} 个任务`)
            await loadList(scope, 1, appliedAccount)
          }}
        >
          <Button icon={<DeleteOutlined />} disabled={counts.done === 0}>
            删除已完成
          </Button>
        </Popconfirm>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadList(scope, page, appliedAccount)}>
          刷新
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        scroll={{ x: 1180 }}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          onChange: (next) => void loadList(scope, next, appliedAccount)
        }}
        columns={[
          { title: '账号', dataIndex: 'account', width: 130 },
          { title: '模型', dataIndex: 'model', width: 170 },
          { title: '协议', dataIndex: 'source', width: 100 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 150,
            render: (value: TaskStatus, row) => (
              <Space direction="vertical" size={0}>
                <Tag color={STATUS_META[value]?.color}>{STATUS_META[value]?.label || value}</Tag>
                <span style={{ color: '#98a2b3', fontSize: 12 }}>{row.status_source === 'manual' ? '手动' : '日志'}</span>
              </Space>
            )
          },
          {
            title: '反馈',
            dataIndex: 'decision',
            render: (_value: string, row) => (
              <div>
                <div>{row.decision}</div>
                <span style={{ color: '#667085', fontSize: 12 }}>
                  finish={row.finish || '-'} result={row.result || '-'} · {row.steps} 次 · {row.last_request_id}
                </span>
                {row.suggested_status !== row.status ? (
                  <div>
                    <Button type="link" size="small" onClick={() => void reevaluateTask(row.id).then(() => loadList(scope, page, appliedAccount))}>
                      采用日志判断（{STATUS_META[row.suggested_status]?.label}）
                    </Button>
                  </div>
                ) : null}
              </div>
            )
          },
          { title: '更新', dataIndex: 'updated_at', width: 170 },
          {
            title: '操作',
            width: 200,
            render: (_value, row: TaskItem) => (
              <Space>
                <Select
                  size="small"
                  value={row.status}
                  options={STATUS_OPTIONS}
                  style={{ width: 96 }}
                  onChange={(value) => void onStatus(row, value)}
                />
                <Popconfirm title="删除这个任务？" okText="删除" cancelText="取消" onConfirm={() => void deleteTask(row.id).then(() => loadList(scope, page, appliedAccount))}>
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />
    </div>
  )
}

export default AdminTasks
