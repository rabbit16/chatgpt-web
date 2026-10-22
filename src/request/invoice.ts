import request from '.'

/**
 * 开发票（前端契约，后端由站长实现）
 * ------------------------------------------------------------
 * 契约文档：docs/后端接口-发票.md
 * 只开「电子普通发票」，不办增值税专用发票（站长确认）。
 * 状态流转：pending（待审核）→ issuing（开票中）→ issued（已开票）
 *           pending / issuing 可以被驳回 rejected（带原因）
 * 后端未部署时，列表接口会失败，页面会展示空态而不是报错刷屏。
 */

export type InvoiceStatus = 'pending' | 'issuing' | 'issued' | 'rejected'
export type InvoiceTitleType = 'company' | 'personal'

export interface InvoiceRecord {
  id: number
  amount: number
  title_type: InvoiceTitleType
  title: string
  tax_no?: string
  email: string
  remark?: string
  order_no?: string
  status: InvoiceStatus
  invoice_no?: string
  reject_reason?: string
  created_at: string
  updated_at?: string
  user_id?: number
  user_name?: string
}

export interface InvoiceSummary {
  /** 累计已充值金额（可开票上限） */
  recharge_total: number
  /** 已开票金额 */
  issued_amount: number
  /** 审核中金额 */
  pending_amount: number
  /** 还能开的金额 = 充值 - 已开票 - 审核中 */
  invoiceable_amount: number
}

export interface InvoiceFormPayload {
  amount: number
  title_type: InvoiceTitleType
  title: string
  tax_no?: string
  email: string
  order_no?: string
  remark?: string
}

export interface InvoiceListQuery {
  page?: number
  page_num?: number
  status?: InvoiceStatus | 'all'
}

export function getInvoiceSummary() {
  return request.post('/user/invoice/summary', {})
}

export function getInvoiceList(params: InvoiceListQuery) {
  return request.post('/user/invoice/list', {
    page: params.page || 1,
    page_num: params.page_num || 10,
    status: params.status && params.status !== 'all' ? params.status : undefined
  })
}

export function createInvoice(params: InvoiceFormPayload) {
  return request.post('/user/invoice/create', params)
}

export function cancelInvoice(id: number) {
  return request.post('/user/invoice/cancel', { id })
}

export function getAdminInvoiceList(params: InvoiceListQuery & { userId?: number }) {
  return request.post('/user/admin/invoice/list', {
    page: params.page || 1,
    page_num: params.page_num || 10,
    status: params.status && params.status !== 'all' ? params.status : undefined,
    userId: params.userId || null
  })
}

export function reviewAdminInvoice(params: {
  id: number
  status: 'issued' | 'rejected'
  invoice_no?: string
  reject_reason?: string
}) {
  return request.post('/user/admin/invoice/review', params)
}
