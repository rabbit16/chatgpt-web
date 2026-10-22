import request from '.'
import { postFeedback } from './api'

/**
 * 开发票（按充值订单开，前端契约，后端由站长实现）
 * ------------------------------------------------------------
 * 契约文档：chatgpt-web/docs/api/invoice.md
 * 只开「电子普通发票」，不办增值税专用发票（站长确认）。
 * 入口：支付记录里对某一笔已支付充值点「开发票」；一单一票，已开票不能重复开。
 * 状态流转：pending（待审核）→ issuing（开票中）→ issued（已开票）
 *           pending / issuing 可以被驳回 rejected（带原因）
 * 后端未部署时，列表接口会失败，页面会展示空态而不是报错刷屏。
 */

export type InvoiceStatus = 'pending' | 'issuing' | 'issued' | 'rejected'
export type InvoiceTitleType = 'company' | 'personal'

export interface InvoiceRecord {
  id: number
  /** 对应的充值订单号（新契约；旧数据可能只有 order_no） */
  bill_id?: string
  amount: number
  title_type: InvoiceTitleType
  title: string
  tax_no?: string
  email: string
  remark?: string
  /** @deprecated 旧字段，等价于 bill_id */
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
  /** 累计已支付充值金额 */
  recharge_total: number
  /** 已开票金额 */
  issued_amount: number
  /** 审核中金额 */
  pending_amount: number
  /** 还能开的金额 = 累计充值 - 已开票 - 审核中 */
  invoiceable_amount: number
}

export interface InvoiceFormPayload {
  /** 必填：要开票的那笔充值订单号（bill_id） */
  bill_id: string
  /** 旧后端兼容字段，金额以后端按订单核验为准 */
  amount?: number
  title_type: InvoiceTitleType
  title: string
  tax_no?: string
  email: string
  /** @deprecated 旧字段，新代码用 bill_id */
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

/* ------------------------------------------------------------------
 * 提交申请：专用接口 → 留言通道 双保险
 * ------------------------------------------------------------------
 * 现状：/user/invoice/* 后端还没写（返回 {"detail":"Not Found"}）。
 * 但站长必须「马上能收到并处理」，所以做两条路：
 *   1. 先试专用接口 /user/invoice/create（后端上线后自动走这条，无需改前端）
 *   2. 接口不通 → 把申请整包塞进「留言」提交（后台「留言」已上线，站长立刻可见）
 * 留言正文第一行是固定标记，管理员页靠它把留言还原成开票申请。
 * ------------------------------------------------------------------ */

/** 留言通道里的开票申请标记，改动需同步 admin/invoices */
export const INVOICE_MARKER = '【发票申请】'

export interface InvoiceSubmitResult {
  /** invoice = 走正式接口；feedback = 降级走留言；failed = 两条都不通 */
  channel: 'invoice' | 'feedback' | 'failed'
  id?: number
  codeMsg?: string
}

export async function submitInvoiceApplication(
  payload: InvoiceFormPayload & { userId?: number; userName?: string }
): Promise<InvoiceSubmitResult> {
  // 1) 正式接口
  try {
    const res: any = await createInvoice(payload)
    const data = res?.data ?? res
    if (String(data?.code ?? '') === '0') {
      return { channel: 'invoice', codeMsg: data?.codeMsg }
    }
  } catch {
    /* 接口不存在或网络异常，继续走留言通道 */
  }

  // 2) 降级：留言通道（后台可见、可回复）
  try {
    const record = {
      bill_id: payload.bill_id,
      amount: payload.amount,
      title_type: payload.title_type,
      title: payload.title,
      tax_no: payload.tax_no || '',
      email: payload.email,
      remark: payload.remark || ''
    }
    const res: any = await postFeedback({
      content: `${INVOICE_MARKER}${JSON.stringify(record)}`,
      contact: payload.email,
      nickname: payload.userName,
      anonymous: false,
      userId: payload.userId ?? null
    })
    const data = res?.data ?? res
    if (String(data?.code ?? '') === '0' || data?.id) {
      return { channel: 'feedback', id: data?.id, codeMsg: data?.codeMsg }
    }
  } catch {
    /* 两条都不通 */
  }

  return { channel: 'failed' }
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
