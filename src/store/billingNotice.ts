import { create } from 'zustand'

export type BillingNotice = {
  input_tokens: number
  output_tokens: number
  cost: number
  balance: number
}

const billingNoticeStore = create<{
  notice: BillingNotice | null
  show: (notice: BillingNotice) => void
  hide: () => void
}>((set) => ({
  notice: null,
  show: (notice) => set({ notice }),
  hide: () => set({ notice: null })
}))

export default billingNoticeStore
