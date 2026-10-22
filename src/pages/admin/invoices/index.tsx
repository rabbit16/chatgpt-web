import { useEffect, useState } from 'react'
import { Button, Input, Modal, Select, Table, Tag, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { getAdminInvoiceList, reviewAdminInvoice, type InvoiceRecord, type InvoiceStatus } from '@/request/invoice'
import styles from '../index.module.less'

/**
 * 后台 · 开票审核
 * ------------------------------------------------------------
 * 站长在这里看一眼申请、填发票号点「通过」，或写原因点「驳回」。
 * 列表可直接导出 CSV（当前筛选结果），方便财务汇总、报税留档。
 */

const STATUS: Record<InvoiceStatus, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'gold' },
  issuing: { label: '开票中', color: 'blue' },
  issued: { label: '已开票', color: 'green' },
  rejected: { label: '已驳回', color: 'red' }
}

function money(value?: number | null) {
  return `¥${Number(value || 0).toFixed(2)}`
}

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function AdminInvoices() {
  const [loading, setLoading] = useState(false)
  const [list, setList] = useState<InvoiceRecord[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all')
  const [userId, setUserId] = useState<number | undefined>()
  const [reviewing, setReviewing] = useState<InvoiceRecord | null>(null)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  const loadList = async (nextPage = 1, nextStatus: InvoiceStatus | 'all' = status, nextUserId = userId) => {
    setLoading(true)
    try {
      const res: any = await getAdminInvoiceList({
        page: nextPage,
        page_num: 10,
        status: nextStatus,
        userId: nextUserId
      })
      const payload = res?.data || {}
      setList(payload.list || [])
      setTotal(Number(payload.total || 0))
      setPage(Number(payload.page || nextPage))
    } catch {
      setList([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadList(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openReview = (record: InvoiceRecord) => {
    setReviewing(record)
    setInvoiceNo(record.invoice_no || '')
    setRejectReason('')
  }

  const submitReview = async (nextStatus: 'issued' | 'rejected') => {
    if (!reviewing) return
    if (nextStatus === 'issued' && !invoiceNo.trim()) {
      message.warning('请先填发票号')
      return
    }
    if (nextStatus === 'rejected' && !rejectReason.trim()) {
      message.warning('驳回要写原因，用户才知道怎么改')
      return
    }
    setSaving(true)
    try {
      await reviewAdminInvoice({
        id: reviewing.id,
        status: nextStatus,
        invoice_no: invoiceNo.trim() || undefined,
        reject_reason: rejectReason.trim() || undefined
      })
      message.success(nextStatus === 'issued' ? '已标记为已开票' : '已驳回')
      setReviewing(null)
      void loadList(page)
    } catch {
      message.error('操作失败：审核接口暂时不可用')
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = () => {
    if (list.length === 0) {
      message.warning('当前没有可导出的记录')
      return
    }
    const header = [
      '申请ID',
      '用户ID',
      '金额',
      '抬头类型',
      '抬头',
      '税号',
      '邮箱',
      '订单号',
      '状态',
      '发票号',
      '驳回原因',
      '申请时间'
    ]
    const rows = list.map((item) => [
      item.id,
      item.user_id,
      Number(item.amount || 0).toFixed(2),
      item.title_type === 'personal' ? '个人' : '企业',
      item.title,
      item.tax_no,
      item.email,
      item.bill_id || item.order_no,
      STATUS[item.status]?.label || item.status,
      item.invoice_no,
      item.reject_reason,
      item.created_at
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `发票申请-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <Input.Search
          allowClear
          placeholder="按用户 ID 筛选"
          style={{ maxWidth: 240 }}
          onSearch={(value) => {
            const next = value ? Number(value) : undefined
            const valid = Number.isFinite(next) ? next : undefined
            setUserId(valid)
            void loadList(1, status, valid)
          }}
        />
        <Select
          value={status}
          style={{ width: 140 }}
          onChange={(value) => {
            setStatus(value)
            void loadList(1, value, userId)
          }}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'pending', label: '待审核' },
            { value: 'issuing', label: '开票中' },
            { value: 'issued', label: '已开票' },
            { value: 'rejected', label: '已驳回' }
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>
          导出 CSV
        </Button>
        <span className={styles.toolbarHint}>一单一票：同一订单只能通过一张发票；导出的是当前页筛选结果。</span>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        scroll={{ x: 1240 }}
        pagination={{
          current: page,
          total,
          pageSize: 10,
          onChange: (next) => void loadList(next)
        }}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 70 },
          { title: '用户', dataIndex: 'user_id', width: 90 },
          {
            title: '订单号',
            dataIndex: 'bill_id',
            width: 160,
            render: (value: string, record: InvoiceRecord) => (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{value || record.order_no || '-'}</span>
            )
          },
          {
            title: '金额',
            dataIndex: 'amount',
            width: 100,
            render: (value) => money(value)
          },
          {
            title: '抬头',
            dataIndex: 'title',
            width: 220,
            render: (value, record: InvoiceRecord) => (
              <div>
                <div>{value}</div>
                {record.tax_no ? <div style={{ fontSize: 12, opacity: 0.7 }}>{record.tax_no}</div> : null}
              </div>
            )
          },
          { title: '邮箱', dataIndex: 'email', width: 180 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (value: InvoiceStatus) => <Tag color={STATUS[value]?.color}>{STATUS[value]?.label || value}</Tag>
          },
          {
            title: '申请时间',
            dataIndex: 'created_at',
            width: 160
          },
          {
            title: '操作',
            width: 120,
            fixed: 'right',
            render: (_, record: InvoiceRecord) =>
              record.status === 'issued' ? (
                <span style={{ fontSize: 12, opacity: 0.7 }}>{record.invoice_no || '已完成'}</span>
              ) : (
                <Button size="small" type="link" onClick={() => openReview(record)}>
                  审核
                </Button>
              )
          }
        ]}
      />

      <Modal
        open={Boolean(reviewing)}
        title={`审核开票申请 #${reviewing?.id ?? ''}`}
        onCancel={() => setReviewing(null)}
        footer={[
          <Button key="cancel" onClick={() => setReviewing(null)}>
            取消
          </Button>,
          <Button key="reject" danger loading={saving} onClick={() => void submitReview('rejected')}>
            驳回
          </Button>,
          <Button key="ok" type="primary" loading={saving} onClick={() => void submitReview('issued')}>
            通过并填发票号
          </Button>
        ]}
      >
        {reviewing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div>
                金额：<b>{money(reviewing.amount)}</b>
              </div>
              <div>抬头：{reviewing.title}</div>
              {reviewing.tax_no ? <div>税号：{reviewing.tax_no}</div> : null}
              <div>邮箱：{reviewing.email}</div>
              {reviewing.bill_id || reviewing.order_no ? (
                <div>订单号：{reviewing.bill_id || reviewing.order_no}</div>
              ) : null}
              {reviewing.remark ? <div>备注：{reviewing.remark}</div> : null}
            </div>
            <Input
              placeholder="发票号（通过时必填，用户可在记录里看到）"
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
            />
            <Input.TextArea
              rows={2}
              placeholder="驳回原因（驳回时必填，会原样展示给用户）"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default AdminInvoices
