import { useCallback, useEffect, useState } from 'react'
import { Button, Empty, Input, Modal, Pagination, Select, Spin, Tag, message } from 'antd'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  getAdminProjectSubmissions,
  reviewProjectSubmission,
  PLATFORM_LABEL,
  type AdminProjectSubmission
} from '@/request/projects'
import styles from '../index.module.less'

/**
 * 后台 · 软件商城审核
 * ------------------------------------------------------------
 * 用户在「软件商城」上传的项目 / 新版本，默认 pending。
 * 站长在这里逐条看：通过 → 出现在商城公开列表；驳回 → 填原因，用户能在「我的提交」看到。
 *
 * 现状：后端 /open-source/* 还没上线，接口不通时本页会把「本机暂存的提交」列出来，
 * 保证本地也能把「提交 → 审核 → 通过」整条流程走一遍。接口上线后自动切到真实数据。
 */

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已驳回', color: 'red' }
}

function AdminProjects() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<AdminProjectSubmission[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [localMode, setLocalMode] = useState(false)
  const [rejecting, setRejecting] = useState<AdminProjectSubmission | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async (nextPage = 1, nextStatus = status) => {
      setLoading(true)
      try {
        const res = await getAdminProjectSubmissions({ status: nextStatus, page: nextPage, page_num: 10 })
        setList(res.list)
        setTotal(res.total)
        setLocalMode(res.local)
        setPage(nextPage)
      } finally {
        setLoading(false)
      }
    },
    [status]
  )

  useEffect(() => {
    void load(1, status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const review = async (item: AdminProjectSubmission, action: 'approve' | 'reject', reason?: string) => {
    setSaving(true)
    try {
      const res = await reviewProjectSubmission({ id: item.id, action, note: reason })
      if (!res.ok) {
        message.error('审核失败：后端接口还没上线，这条记录只在浏览器本地')
        return
      }
      message.success(action === 'approve' ? '已通过，商城会展示这个项目' : '已驳回，用户能看到原因')
      setRejecting(null)
      setNote('')
      void load(page, status)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Select
          value={status}
          style={{ width: 150 }}
          onChange={(value) => setStatus(value)}
          options={[
            { value: 'pending', label: '待审核' },
            { value: 'approved', label: '已通过' },
            { value: 'rejected', label: '已驳回' },
            { value: 'all', label: '全部' }
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void load(page, status)} loading={loading}>
          刷新
        </Button>
        <span className={styles.toolbarHint}>
          提交后默认待审核，通过才会出现在「软件商城」；驳回要写原因，用户在「我的提交」能看到。
        </span>
      </div>

      {localMode ? (
        <div className={styles.invoiceAsk} style={{ marginBottom: 12 }}>
          <div className={styles.invoiceAskHead}>
            <Tag color="orange">本地模式</Tag>
            <strong>后端接口还没上线</strong>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-4)' }}>
            下面列的是当前浏览器里暂存的提交（只有你自己这台电脑能看到）。站长正式收件需要后端实现{' '}
            <code>/open-source/*</code>，接口约定见 <code>docs/后端接口-开源项目.md</code>。
          </p>
        </div>
      ) : null}

      <Spin spinning={loading}>
        {list.length === 0 ? (
          <Empty description={status === 'pending' ? '没有待审核的提交' : '这个状态下还没有记录'} />
        ) : (
          <div className={styles.feed}>
            {list.map((item) => (
              <article key={String(item.id)} className={styles.feedItem}>
                <header className={styles.feedHead}>
                  <strong>{item.name}</strong>
                  <Tag color={STATUS[item.status || 'pending']?.color}>
                    {STATUS[item.status || 'pending']?.label}
                  </Tag>
                  {String(item.id).startsWith('local-') ? <Tag>本机暂存</Tag> : null}
                  {item.official ? <Tag color="blue">官方</Tag> : null}
                  <time>{item.updated_at || ''}</time>
                </header>
                <p className={styles.feedBody}>{item.summary}</p>
                <div className={styles.invoiceAskGrid} style={{ marginTop: 8 }}>
                  <div>
                    <dt>提交人</dt>
                    <dd>{item.author_name || item.user_name || '-'}</dd>
                  </div>
                  <div>
                    <dt>仓库</dt>
                    <dd>{item.repo_url || '-'}</dd>
                  </div>
                  <div>
                    <dt>版本 / 平台</dt>
                    <dd>
                      {(item.releases || [])
                        .map((r) => `${r.version} · ${PLATFORM_LABEL[r.platform] || r.platform}`)
                        .join(' / ') || '-'}
                    </dd>
                  </div>
                </div>
                {(item.releases || []).length ? (
                  <div className={styles.invoiceAskGrid} style={{ marginTop: 8 }}>
                    {(item.releases || []).map((r) => (
                      <div key={String(r.id)}>
                        <dt>
                          {PLATFORM_LABEL[r.platform] || r.platform} · {r.version}
                        </dt>
                        <dd>
                          <a href={r.file_url} target="_blank" rel="noreferrer">
                            {r.file_url}
                          </a>
                        </dd>
                      </div>
                    ))}
                  </div>
                ) : null}
                <footer className={styles.feedFoot}>
                  <span>#{String(item.id)}</span>
                  <div>
                    <Button
                      type="link"
                      icon={<CheckOutlined />}
                      loading={saving}
                      onClick={() => void review(item, 'approve')}
                    >
                      通过上架
                    </Button>
                    <Button type="link" danger icon={<CloseOutlined />} onClick={() => setRejecting(item)}>
                      驳回
                    </Button>
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </Spin>

      {total > 10 ? (
        <div className={styles.feedPager}>
          <Pagination
            current={page}
            total={total}
            pageSize={10}
            showSizeChanger={false}
            onChange={(next) => void load(next, status)}
          />
        </div>
      ) : null}

      <Modal
        title="驳回提交"
        open={Boolean(rejecting)}
        okText="确认驳回"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ danger: true }}
        onOk={() => {
          if (!rejecting) return
          if (!note.trim()) {
            message.warning('请写一句原因，用户要知道怎么改')
            return
          }
          void review(rejecting, 'reject', note.trim())
        }}
        onCancel={() => {
          setRejecting(null)
          setNote('')
        }}
        destroyOnClose
      >
        <p style={{ marginTop: 0 }}>
          驳回 <strong>{rejecting?.name}</strong>，原因会显示给提交人。
        </p>
        <Input.TextArea
          rows={4}
          maxLength={300}
          showCount
          value={note}
          placeholder="例如：下载链接打不开，请换成直链或网盘链接"
          onChange={(event) => setNote(event.target.value)}
        />
      </Modal>
    </div>
  )
}

export default AdminProjects
