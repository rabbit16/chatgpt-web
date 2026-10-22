// 虎皮椒手机端跳走再回来会刷新页面，订单号必须落盘，回来后再查一次。
export type PendingOrder = {
  outTradeNo: string
  channel: 'xunhupay'
  money: number
  createdAt: number
}

const PENDING_KEY = 'pending_pay_order'

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
