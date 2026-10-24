import request from '.'

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
  /**
   * 要开票的充值订单号（bill_id）
   * - 单笔：就是那一笔的订单号
   * - 合并（2026-10-24 新增）：多个订单号用英文逗号拼接，形如 "B1,B2,B3"
   *
   * 为什么合并时还留着 string 而不是改成数组：
   *   后端现在只认单笔 bill_id，数组字段它会直接忽略/报错。
   *   用逗号拼成字符串，旧后端至少能拿到"一个订单号"（第一笔），
   *   不会因为字段类型变化把整条请求判为非法。等后端上线 bill_ids 后再以数组为准。
   */
  bill_id: string
  /**
   * 合并开票的订单号数组（2026-10-24 新增，可选）
   *
   * 为什么同时传 bill_id 和 bill_ids 两种：
   *   1. 新后端读 bill_ids 数组，能准确知道要合并哪几笔；
   *   2. 老后端只读 bill_id（字符串），不传就会被当成"没选订单"直接拒；
   *   3. 前端无法在提交前可靠判断后端版本，两个都带上 = 谁都能读到自己的字段。
   *   冗余只有几十字节，比"猜后端版本猜错导致提交失败"划算。
   * 单笔开票时不传这个字段，保持和旧行为完全一致。
   */
  bill_ids?: string[]
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
 * 提交申请：只走专用接口，失败就如实告诉用户
 * ------------------------------------------------------------------
 * 2026-10-23 站长反馈的 bug：点「开发票」会往**公开留言墙**投一条实名消息。
 *
 * 原设计是「专用接口不通 → 把申请塞进留言接口」当双保险。问题在于：
 *   1. 留言接口本身是公开的（/notice?tab=feedback 游客免登录可见），
 *      而开票申请含**税号 + 邮箱 + 真实姓名**，属于个人敏感信息；
 *   2. 前端虽然按前缀过滤了公开列表，但那只是"不渲染"，
 *      接口仍会把原始内容返回给任何调用者，等于数据已经出站；
 *   3. 后端一旦在 content 前加包装（如拼昵称、加空格），
 *      startsWith 判断失效，敏感内容就直接显示在公开墙上了。
 *
 * 结论：隐私数据不能靠"前端过滤"来保护，只能**根本不写进去**。
 * 现在后端接口没上线时，明确告知用户「暂不可用」，而不是偷偷把资料投到公开墙上。
 * 等站长按 docs/api/invoice.md 实现 /user/invoice/create 后，这条路径自动生效。
 * ------------------------------------------------------------------ */

/** @deprecated 留言通道已停用，仅保留标记供后台历史数据识别 */
export const INVOICE_MARKER = '【发票申请】'

export interface InvoiceSubmitResult {
  /** invoice = 走正式接口；unavailable = 后端未实现；business = 后端明确拒绝；failed = 网络异常 */
  channel: 'invoice' | 'unavailable' | 'business' | 'failed'
  id?: number
  codeMsg?: string
}

export async function submitInvoiceApplication(
  payload: InvoiceFormPayload & { userId?: number; userName?: string }
): Promise<InvoiceSubmitResult> {
  try {
    const res: any = await createInvoice(payload)
    const data = res?.data ?? res
    const code = String(data?.code ?? '')
    // 成功判定放宽：后端不同版本里 code 可能是数字 0、字符串 "0"，也可能只回了
    // id / invoice 而没有 code。只要没有明确失败码，就认为申请已落库——
    // 站长之后能在后台审核列表里看到这条，不该再提示「通道未开通」。
    const hasPayload = Boolean(data?.id || data?.invoice || (data?.data && data.data.id))
    if (code === '0' || (!code && hasPayload)) {
      return { channel: 'invoice', id: data?.id ?? data?.data?.id, codeMsg: data?.codeMsg }
    }
    // 后端返回了业务错误（如「该订单已开过发票」）。
    // 这跟「接口没上线」是两回事：调用方要显示成失败（error）并刷新列表，
    // 否则那笔订单的「开发票」按钮还在，用户会反复点、反复报错。
    if (code && code !== '404') {
      return { channel: 'business', codeMsg: data?.codeMsg }
    }
  } catch {
    /* 接口不存在或网络异常 */
  }

  return { channel: 'unavailable' }
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
