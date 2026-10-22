import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// xunhupay: 虎皮椒（/user/xunhupay/*）
// lantu: 旧的蓝兔聚合通道（/user/pay_rabbit + /user/verify_pay_again）
export type PayChannel = 'xunhupay' | 'lantu'

export interface PaymentState {
  // 当前生效的支付通道，以后端全局配置为准，本地只做缓存
  channel: PayChannel
  // 通道列表，由后端返回
  channels: Array<{ value: PayChannel; name: string }>
  // 是否已从后端同步过，避免首屏误用旧缓存
  synced: boolean
  setChannel: (channel: PayChannel) => void
  setFromServer: (data: {
    channel?: PayChannel
    channels?: Array<{ value: PayChannel; name: string }>
  }) => void
}

const paymentStore = create<PaymentState>()(
  persist(
    (set) => ({
      channel: 'xunhupay',
      channels: [],
      synced: false,
      setChannel: (channel) => set({ channel }),
      setFromServer: (data) =>
        set((state) => ({
          channel: data.channel || state.channel,
          channels: data.channels?.length ? data.channels : state.channels,
          synced: true
        }))
    }),
    {
      name: 'payment_storage',
      storage: createJSONStorage(() => localStorage),
      // synced 只表示本次会话已同步，不要持久化。
      partialize: (state) => ({ channel: state.channel, channels: state.channels })
    }
  )
)

export default paymentStore
