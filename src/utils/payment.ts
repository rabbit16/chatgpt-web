// 虎皮椒手机端跳走再回来会刷新页面，订单号必须落盘，回来后再查一次。
export type PendingOrder = {
  outTradeNo: string
  channel: 'xunhupay'
  money: number
  createdAt: number
}

const PENDING_KEY = 'pending_pay_order'

/**
 * 后端返回有两套形状：
 * - 老接口：字段包在 data 里（如 { code, data: { code: '0', ... } }）
 * - 虎皮椒接口：字段直接放顶层，data 是空字符串（如 { code: '0', outTradeNo, payUrl }）
 * 页面只想要一个对象，这里统一成「顶层为主、data 里的对象补进来」。
 */
export function normalizePayload<T = Record<string, any>>(res: any): T & { code?: string | number; codeMsg?: string } {
  if (!res || typeof res !== 'object') return {} as T
  const nested = res.data && typeof res.data === 'object' && !Array.isArray(res.data) ? res.data : null
  return (nested ? { ...res, ...nested } : { ...res }) as T & { code?: string | number }
}

/** 后端约定 code === '0' 为成功（有的接口用数字 0，一起兼容）。 */
export function isPayOk(res: any): boolean {
  const code = normalizePayload(res).code
  return String(code ?? '') === '0'
}

/** 出错时给用户看的话：优先用后端 codeMsg，没有就用兜底文案。 */
export function payErrorMessage(res: any, fallback: string): string {
  return normalizePayload(res).codeMsg || fallback
}

export function savePendingOrder(order: PendingOrder) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(order))
  } catch {
    // 隐私模式下 localStorage 不可用，忽略即可。
  }
}

export function readPendingOrder(): PendingOrder | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingOrder
    if (!parsed?.outTradeNo) return null
    // 超过 30 分钟的订单不再自动确认。
    if (Date.now() - Number(parsed.createdAt || 0) > 30 * 60 * 1000) {
      clearPendingOrder()
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingOrder() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    // 忽略。
  }
}
