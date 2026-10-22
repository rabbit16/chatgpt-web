import { useEffect, useState } from 'react'
import { Button, Empty, Input, Modal, Pagination, Spin, Switch, Tag, message } from 'antd'
import { getAdminFeedback, updateAdminFeedback } from '@/request/api'
import { INVOICE_MARKER } from '@/request/invoice'
import styles from '../index.module.less'

/**
 * 开票申请识别
 * ------------------------------------------------------------
 * 发票专用接口还没上线，用户提交的申请会以「【发票申请】{...}」的形式落到留言里。
 * 这里把那段 JSON 解析出来单独排版：订单号、金额、抬头、税号、邮箱一眼可见，
 * 站长不用去读原始字符串；其他留言照旧显示原文。
 */
type InvoicePayload = {
  bill_id?: string
  amount?: number
  title_type?: string
  title?: string
  tax_no?: string
  email?: string
  remark?: string
}

function parseInvoice(content: string): InvoicePayload | null {
  if (!content?.startsWith(INVOICE_MARKER)) return null
  try {
    return JSON.parse(content.slice(INVOICE_MARKER.length)) as InvoicePayload
  } catch {
    return null
  }
}

function InvoiceBody({ data, raw }: { data: InvoicePayload; raw: string }) {
  return (
    <div className={styles.invoiceAsk}>
      <div className={styles.invoiceAskHead}>
        <Tag color="gold">开票申请</Tag>
        <strong>¥{Number(data.amount || 0).toFixed(2)}</strong>
        <span>订单号 {data.bill_id || '-'}</span>
      </div>
      <dl className={styles.invoiceAskGrid}>
        <div>
          <dt>{data.title_type === 'personal' ? '个人姓名' : '公司名称'}</dt>
          <dd>{data.title || '-'}</dd>
        </div>
        <div>
          <dt>税号</dt>
          <dd>{data.tax_no || '（个人抬头无需税号）'}</dd>
        </div>
        <div>
          <dt>收票邮箱</dt>
          <dd>{data.email || '-'}</dd>
        </div>
        {data.remark ? (
          <div>
            <dt>备注</dt>
            <dd>{data.remark}</dd>
          </div>
        ) : null}
      </dl>
      <details className={styles.invoiceAskRaw}>
        <summary>查看原始内容</summary>
        <code>{raw}</code>
      </details>
    </div>
  )
}

function AdminFeedback() {
  const [loading, setLoading] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [replying, setReplying] = useState<any>(null)
  const [replyText, setReplyText] = useState('')
  const [savingReply, setSavingReply] = useState(false)

  const loadList = async (nextPage = 1, unread = onlyUnread) => {
    setLoading(true)
    try {
      const res: any = await getAdminFeedback({
        page: nextPage,
        page_num: 10,
        only_unread: unread
      })
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

  const updateItem = async (id: number, payload: { is_read?: boolean; is_delete?: boolean; reply?: string }) => {
    const res: any = await updateAdminFeedback({ id, ...payload })
    if (res?.data?.code === '0' || res?.code === 0) {
      message.success(res?.data?.codeMsg || '已更新')
      loadList(page)
      return true
    }
    return false
  }

  const openReply = (row: any) => {
    setReplying(row)
    setReplyText(row.reply || '')
  }

  const saveReply = async () => {
    if (!replying) return
    const text = replyText.trim()
    if (text.length > 2000) {
      message.warning('回复最多 2000 字')
      return
    }
    setSavingReply(true)
    try {
      const ok = await updateItem(replying.id, { reply: text })
      if (ok) setReplying(null)
    } finally {
      setSavingReply(false)
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <span>只看未读</span>
        <Switch
          checked={onlyUnread}
          onChange={(checked) => {
            setOnlyUnread(checked)
            loadList(1, checked)
          }}
        />
      </div>
      <Spin spinning={loading}>
        {list.length === 0 ? (
          <Empty description="没有留言" />
        ) : (
          <div className={styles.feed}>
            {list.map((row) => (
              <article key={row.id} className={styles.feedItem}>
                <header className={styles.feedHead}>
                  <strong>{row.nickname || '匿名用户'}</strong>
                  {row.anonymous ? <Tag>匿名</Tag> : <Tag color="blue">署名</Tag>}
                  {row.is_read ? <Tag>已读</Tag> : <Tag color="orange">未读</Tag>}
                  {row.is_delete ? <Tag color="red">已隐藏</Tag> : null}
                  <time>{row.insert_time}</time>
                </header>
                {(() => {
                  const invoice = parseInvoice(String(row.content || ''))
                  return invoice ? (
                    <InvoiceBody data={invoice} raw={String(row.content)} />
                  ) : (
                    <p className={styles.feedBody}>{row.content}</p>
                  )
                })()}
                {row.reply ? (
                  <div className={styles.feedReply}>
                    <div className={styles.feedReplyMeta}>
                      <strong>管理员回复</strong>
                      {row.reply_time ? <time>{row.reply_time}</time> : null}
                    </div>
                    <p>{row.reply}</p>
                  </div>
                ) : null}
                <footer className={styles.feedFoot}>
                  <span>
                    #{row.id}
                    {row.contact ? ` · ${row.contact}` : ''}
                    {row.ip ? ` · ${row.ip}` : ''}
                    {row.user_id ? ` · 用户 ${row.user_id}` : ''}
                  </span>
                  <div>
                    <Button type="link" onClick={() => openReply(row)}>
                      {row.reply ? '改回复' : '回复'}
                    </Button>
                    {!row.is_read ? (
                      <Button type="link" onClick={() => updateItem(row.id, { is_read: true })}>
                        标已读
                      </Button>
                    ) : null}
                    <Button
                      type="link"
                      danger={!row.is_delete}
                      onClick={() => updateItem(row.id, { is_delete: !row.is_delete })}
                    >
                      {row.is_delete ? '恢复' : '隐藏'}
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
            onChange={(next) => loadList(next)}
          />
        </div>
      ) : null}
      <Modal
        title={replying?.reply ? '修改回复' : '回复留言'}
        open={Boolean(replying)}
        okText="发布回复"
        cancelText="取消"
        confirmLoading={savingReply}
        onOk={saveReply}
        onCancel={() => setReplying(null)}
        destroyOnClose
      >
        <p className={styles.replySource}>{replying?.content}</p>
        <Input.TextArea
          rows={5}
          maxLength={2000}
          showCount
          value={replyText}
          placeholder="回复会公开显示在这条留言下面。留空再发布，会清空已有回复。"
          onChange={(event) => setReplyText(event.target.value)}
        />
      </Modal>
    </div>
  )
}

export default AdminFeedback
