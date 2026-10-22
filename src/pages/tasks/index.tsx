import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { CheckOutlined, DeleteOutlined, ProfileOutlined, ReloadOutlined } from '@ant-design/icons'
import Layout from '@/components/Layout'
import { userStore } from '@/store'
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
import styles from './index.module.less'

const PAGE_SIZE = 20

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

function TasksPage() {
  const { token, setLoginModal } = userStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<TaskScope>('running')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [list, setList] = useState<TaskItem[]>([])
  const [counts, setCounts] = useState<TaskCounts>(EMPTY_COUNTS)
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadList = useCallback(async (nextScope = scope, nextPage = 1) => {
    if (!token) {
      setList([])
      setTotal(0)
      setCounts(EMPTY_COUNTS)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await getTaskList({
        scope: nextScope,
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
  }, [scope, token])

  useEffect(() => {
    void loadList(scope, 1)
  }, [loadList, scope])

  async function onStatus(row: TaskItem, status: TaskStatus) {
    if (status === row.status) return
    setBusyId(row.id)
    try {
      await updateTaskStatus({ id: row.id, status })
      message.success('已按你的设置更新状态')
      await loadList(scope, page)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新状态失败')
    } finally {
      setBusyId(null)
    }
  }

  async function onReevaluate(row: TaskItem) {
    setBusyId(row.id)
    try {
      await reevaluateTask(row.id)
      message.success('已改回日志判断')
      await loadList(scope, page)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重新判断失败')
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(row: TaskItem) {
    setBusyId(row.id)
    try {
      await deleteTask(row.id)
      message.success('任务已删除')
      await loadList(scope, page)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
    } finally {
      setBusyId(null)
    }
  }

  async function onCompleteAll() {
    setLoading(true)
    try {
      const data = await completeAllTasks()
      message.success(`已把 ${data.updated} 个进行中的任务标成完成`)
      await loadList(scope, 1)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
      setLoading(false)
    }
  }

  async function onDeleteDone() {
    setLoading(true)
    try {
      const data = await deleteDoneTasks()
      message.success(`已删除 ${data.deleted} 个已完成任务`)
      await loadList(scope, 1)
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败')
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Layout>
        <div className={styles.wrap}>
          <section className={styles.hero}>
            <p className={styles.kicker}>
              <ProfileOutlined /> 任务进度
            </p>
            <h1>还有哪些没跑完</h1>
            <p className={styles.lead}>
              任务由中转日志自动归并。Claude 的 tool_use，以及 OpenAI 响应里的 function_call，都表示模型还在调工具，任务进行中。没有待执行工具的 end_turn、stop、completed 才表示这一轮结束。请求失败，或 result 是 error、incomplete，记为失败。同一会话里连续的工具调用算同一个任务。
            </p>
          </section>

          {!token ? (
            <Alert
              showIcon
              type="info"
              message="需要登录"
              description="登录后只能看到自己的任务。"
              action={
                <Button size="small" type="primary" onClick={() => setLoginModal(true)}>
                  登录
                </Button>
              }
            />
          ) : null}

          {error ? <Alert showIcon type="warning" message={error} /> : null}

          {token ? (
            <>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span>进行中</span>
                  <strong>{counts.running}</strong>
                </div>
                <div className={styles.stat}>
                  <span>失败</span>
                  <strong>{counts.failed}</strong>
                </div>
                <div className={styles.stat}>
                  <span>已完成</span>
                  <strong>{counts.done}</strong>
                </div>
                <div className={styles.stat}>
                  <span>全部</span>
                  <strong>{counts.all}</strong>
                </div>
              </div>

              <div className={styles.toolbar}>
                <div className={styles.filters}>
                  {FILTERS.map((item) => (
                    <Button
                      key={item.value}
                      type={scope === item.value ? 'primary' : 'default'}
                      onClick={() => setScope(item.value)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                <Space wrap>
                  <Popconfirm title="把所有进行中的任务标成已完成？" okText="全部完成" cancelText="取消" onConfirm={() => void onCompleteAll()}>
                    <Button icon={<CheckOutlined />} disabled={counts.running === 0}>
                      一键全部完成
                    </Button>
                  </Popconfirm>
                  <Popconfirm title="删除所有已完成任务？" okText="删除" cancelText="取消" onConfirm={() => void onDeleteDone()}>
                    <Button icon={<DeleteOutlined />} disabled={counts.done === 0}>
                      删除已完成
                    </Button>
                  </Popconfirm>
                  <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadList(scope, page)}>
                    刷新
                  </Button>
                </Space>
              </div>

              <Table
                rowKey="id"
                loading={loading}
                dataSource={list}
                pagination={{
                  current: page,
                  pageSize: PAGE_SIZE,
                  total,
                  showSizeChanger: false,
                  onChange: (next) => void loadList(scope, next)
                }}
                scroll={{ x: 980 }}
                locale={{ emptyText: scope === 'running' ? '没有正在进行的任务' : '这个分类下还没有任务' }}
                columns={[
                  {
                    title: '模型',
                    dataIndex: 'model',
                    width: 180,
                    render: (value: string, row) => (
                      <div>
                        <div>{value || '-'}</div>
                        <span style={{ color: '#98a2b3', fontSize: 12 }}>{row.source}</span>
                      </div>
                    )
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 150,
                    render: (value: TaskStatus, row) => (
                      <Space direction="vertical" size={4}>
                        <Tag color={STATUS_META[value]?.color}>{STATUS_META[value]?.label || value}</Tag>
                        <span style={{ color: '#98a2b3', fontSize: 12 }}>
                          {row.status_source === 'manual' ? '手动设置' : '日志判断'}
                        </span>
                      </Space>
                    )
                  },
                  {
                    title: '日志反馈',
                    dataIndex: 'decision',
                    render: (_value: string, row) => (
                      <div>
                        <div>{row.decision}</div>
                        <span style={{ color: '#667085', fontSize: 12 }}>
                          finish={row.finish || '-'} result={row.result || '-'} · {row.steps} 次请求
                        </span>
                        {row.suggested_status && row.suggested_status !== row.status ? (
                          <div>
                            <Button type="link" size="small" onClick={() => void onReevaluate(row)}>
                              日志建议改为{STATUS_META[row.suggested_status]?.label}，采用
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )
                  },
                  {
                    title: '更新时间',
                    dataIndex: 'updated_at',
                    width: 170,
                    render: (value: string) => value || '-'
                  },
                  {
                    title: '操作',
                    width: 220,
                    render: (_value, row: TaskItem) => (
                      <Space wrap>
                        <Select
                          size="small"
                          value={row.status}
                          options={STATUS_OPTIONS}
                          style={{ width: 96 }}
                          disabled={busyId === row.id}
                          onChange={(value) => void onStatus(row, value)}
                        />
                        <Popconfirm title="删除这个任务？" okText="删除" cancelText="取消" onConfirm={() => void onDelete(row)}>
                          <Button size="small" danger loading={busyId === row.id}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    )
                  }
                ]}
              />
            </>
          ) : null}
        </div>
      </Layout>
    </div>
  )
}

export default TasksPage
