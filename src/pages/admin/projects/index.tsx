import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Modal, Pagination, Select, Spin, Tag, message } from 'antd'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  PLATFORM_LABEL,
  REVIEW_LABEL,
  formatFileSize,
  getReviewList,
  platformsOf,
  reviewSoftware,
  isLocalId,
  type ReviewStatus,
  type SoftwareRecord
} from '@/request/software'
import styles from '../index.module.less'

/**
 * 后台 · 用户上传审核
 * ------------------------------------------------------------
 * 只处理 source=user 的投稿：用户提交后 review_status=pending、status=0。
 *   · 通过 → review_status=approved、status=1，立刻出现在商城公开列表
 *   · 驳回 → review_status=rejected、status=0，原因写进 reviewer_note，用户在「我的提交」能看到
 *
 * 官方软件不经过这里（管理员在「软件下载 → 管理员直传」提交即上架）。
 * 接口未上线时自动降级为本地模式：列出本机暂存的投稿，审核结果也存在本机。
 */

const STATUS_COLOR: Record<ReviewStatus, string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red'
}

function AdminProjects() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<SoftwareRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<ReviewStatus | 'all'>('pending')
  const [localMode, setLocalMode] = useState(false)
  const [rejecting, setRejecting] = useState<SoftwareRecord | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(
    async (nextPage = 1, nextStatus: ReviewStatus | 'all' = status) => {
      setLoading(true)
      try {
        const res = await getReviewList({ status: nextStatus, page: nextPage, page_num: 10 })
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

  const review = async (item: SoftwareRecord, action: 'approve' | 'reject', reason?: string) => {
    if (action === 'reject' && !reason?.trim()) {
      message.warning('驳回必须写原因，用户要知道怎么改')
      return
    }
    setSaving(true)
    try {
      const res = await reviewSoftware({ id: item.id, action, note: reason })
      if (!res.ok) {
        message.error('审核失败：这条记录不在本机，后端接口可能还没上线')
        return
      }
      message.success(
        action === 'approve'
          ? res.local
            ? '已通过（本地暂存），商城会展示这条投稿'
            : '已通过，商城会展示这条投稿'
          : '已驳回，用户能在「我的提交」看到原因'
      )
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
          这里只审「用户上传」的投稿；官方软件在「软件下载 → 管理员直传」提交即上架，不进这个队列。
        </span>
      </div>

      {localMode ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12, borderRadius: 16 }}
          message="本地模式：后端审核接口未接入"
          description="下面是这台浏览器暂存的投稿（只有你自己能看到），通过/驳回也只在本机生效。接口 /user/admin/software/review/* 上线后自动切到真实数据。"
        />
      ) : null}

      <Spin spinning={loading}>
        {list.length === 0 ? (
          <Empty description={status === 'pending' ? '没有待审核的投稿' : '这个状态下还没有记录'} />
        ) : (
          <div className={styles.feed}>
            {list.map((item) => (
              <article key={String(item.id)} className={styles.feedItem}>
                <header className={styles.feedHead}>
                  <strong>{item.name}</strong>
                  <Tag color={STATUS_COLOR[item.review_status] || 'gold'}>
                    {REVIEW_LABEL[item.review_status] || item.review_status}
                  </Tag>
                  {isLocalId(item.id) ? <Tag>本机暂存</Tag> : null}
                  <time>{item.insert_time || item.update_time || ''}</time>
                </header>
                <p className={styles.feedBody}>{item.summary}</p>
                {(() => {
                  // 平台/安装包统一走 platformsOf：用户可能一次提交多个平台，
                  // 审核时每个都要能点开看包，不能只显示第一个。
                  const entries = platformsOf(item)
                  return (
                    <div className={styles.invoiceAskGrid} style={{ marginTop: 8 }}>
                      <div>
                        <dt>提交人</dt>
                        <dd>{item.author_name || '-'}</dd>
                      </div>
                      <div>
                        <dt>版本 / 平台数</dt>
                        <dd>
                          {item.version ? `v${item.version}` : '-'} ·{' '}
                          {entries.length ? `${entries.length} 个平台` : '-'}
                        </dd>
                      </div>
                      <div>
                        <dt>安装包</dt>
                        <dd>
                          {entries.length
                            ? entries
                                .map((entry) => PLATFORM_LABEL[entry.platform])
                                .join(' / ')
                            : '-'}
                        </dd>
                      </div>
                    </div>
                  )
                })()}
                {(() => {
                  const entries = platformsOf(item)
                  if (!entries.length) return null
                  return (
                    <div className={styles.invoiceAskGrid} style={{ marginTop: 8 }}>
                      {entries.map((entry) => (
                        <div key={entry.platform}>
                          <dt>
                            {PLATFORM_LABEL[entry.platform]} ·{' '}
                            {formatFileSize(entry.file_size || item.file_size) || '体积未标注'}
                          </dt>
                          <dd>
                            {entry.file_url ? (
                              <a href={entry.file_url} target="_blank" rel="noreferrer">
                                {entry.file_url}
                              </a>
                            ) : (
                              '未填链接'
                            )}
                          </dd>
                        </div>
                      ))}
                    </div>
                  )
                })()}
                {item.repo_url ? (
                  <p className={styles.feedBody} style={{ marginTop: 6 }}>
                    仓库：{item.repo_url}
                  </p>
                ) : null}
                {item.changelog ? (
                  <p className={styles.feedBody} style={{ marginTop: 6 }}>
                    更新说明：{item.changelog}
                  </p>
                ) : null}
                {item.review_status === 'rejected' && item.reviewer_note ? (
                  <p className={styles.feedBody} style={{ marginTop: 6, color: '#d4380d' }}>
                    驳回原因：{item.reviewer_note}
                  </p>
                ) : null}
                <footer className={styles.feedFoot}>
                  <span>#{String(item.id)}</span>
                  <div>
                    {item.review_status !== 'approved' ? (
                      <Button
                        type="link"
                        icon={<CheckOutlined />}
                        loading={saving}
                        onClick={() => void review(item, 'approve')}
                      >
                        通过上架
                      </Button>
                    ) : null}
                    {item.review_status !== 'rejected' ? (
                      <Button type="link" danger icon={<CloseOutlined />} onClick={() => setRejecting(item)}>
                        驳回
                      </Button>
                    ) : null}
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
        title="驳回投稿"
        open={Boolean(rejecting)}
        okText="确认驳回"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ danger: true }}
        onOk={() => void review(rejecting!, 'reject', note)}
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
