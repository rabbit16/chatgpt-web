import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { ConsumeRecordInfo, InvitationRecordInfo, ResponseLoginData, UserInfo } from '@/types'
import { TableData } from '@/types/admin'

export interface userState {
  // 登录弹窗开关
  loginModal: boolean
  // 是否以「匿名体验」的引导态打开登录弹窗（未登录发消息时触发）
  anonSignupHint: boolean
  openAnonSignup: () => void
  clearAnonSignupHint: () => void
  // 用户信息
  user_info: UserInfo | undefined
  // 登录Token
  token: string | undefined
  // token 签发后 24 小时失效
  token_expires_at?: number
  llm_api_key: string
  allow_phone_key: boolean | null
  // 修改登录弹窗
  setLoginModal: (value: boolean) => void
  setLlmAccess: (data: { llm_api_key?: string; allow_phone_key?: boolean | null }) => void
  // 登录
  login: (data: ResponseLoginData) => void
  // 退出
  logout: () => void
  expireSession: () => void
  // 记录数据
  invitation_records: TableData<InvitationRecordInfo>
  // 消费记录
  consume_records: TableData<ConsumeRecordInfo>
  // 提现记录
  withdrawal_records: TableData<InvitationRecordInfo>
  changeRecords: (data: TableData<any>, type: string | number) => void
  changeUserCurrentAmount: (amount?: number) => void
  upglobal: number,
  upDataGlobal: () => void

}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

const userStore = create<userState>()(
  persist(
    (set) => ({
      loginModal: false,
      anonSignupHint: false,
      openAnonSignup: () => set({ loginModal: true, anonSignupHint: true }),
      clearAnonSignupHint: () => set({ anonSignupHint: false }),
      user_info: undefined,
      token: undefined,
      token_expires_at: undefined,
      llm_api_key: '',
      allow_phone_key: null,
      setLoginModal: (value) => set({ loginModal: value }),
      setLlmAccess: (data) => set((state) => ({ ...state, ...data })),
      login: (data) => set(() => ({
        ...data,
        token_expires_at: data.token ? Date.now() + TOKEN_TTL_MS : undefined
      })),
      logout: () => set(() => ({ user_info: undefined, token: undefined, token_expires_at: undefined, llm_api_key: '', allow_phone_key: null })),
      expireSession: () => set(() => ({ loginModal: true, token: undefined, token_expires_at: undefined, llm_api_key: '' })),
      invitation_records: {
        count: 0,
        rows: []
      },
      upglobal: 1,
      upDataGlobal: () => set(() => ({ upglobal: Math.random() })),
      consume_records: {
        count: 0,
        rows: []
      },
      withdrawal_records: {
        count: 0,
        rows: []
      },
      changeUserCurrentAmount: (amount) =>
        set((state) => {
          const current_amount = amount ? Number(state.user_info?.current_amount || 0) + amount : 0
          const userInfo = {
            ...(state.user_info || {}),
            current_amount
          } as UserInfo
          return {
            user_info: userInfo
          }
        }),
      changeRecords: (data, type) =>
        set(() => {
          if (type === 'invitation_records') {
            return {
              invitation_records: { ...data }
            }
          }

          if (type === 'consume_records') {
            return {
              consume_records: { ...data }
            }
          }

          if (type === 'withdrawal_records') {
            return {
              withdrawal_records: { ...data }
            }
          }

          return {}
        })
    }),
    {
      name: 'user_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user_info: state.user_info,
        upglobal: state.upglobal,
        token: state.token,
        token_expires_at: state.token_expires_at
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.token) return
        if (!state.token_expires_at) {
          userStore.setState({ token_expires_at: Date.now() + TOKEN_TTL_MS })
          return
        }
        if (state.token_expires_at <= Date.now()) {
          userStore.setState({ token: undefined, token_expires_at: undefined, llm_api_key: '' })
        }
      }
    }
  )
)
try {
  const persisted = localStorage.getItem('user_storage')
  if (persisted) {
    const parsed = JSON.parse(persisted)
    const state = parsed?.state || {}
    const token = typeof state.token === 'string' && state.token ? state.token : undefined
    let tokenExpiresAt = typeof state.token_expires_at === 'number' ? state.token_expires_at : undefined
    if (token && !tokenExpiresAt) tokenExpiresAt = Date.now() + TOKEN_TTL_MS
    const tokenValid = Boolean(token && tokenExpiresAt && tokenExpiresAt > Date.now())
    localStorage.setItem('user_storage', JSON.stringify({
      ...parsed,
      state: {
        user_info: state.user_info,
        upglobal: state.upglobal ?? 1,
        ...(tokenValid ? { token, token_expires_at: tokenExpiresAt } : {})
      }
    }))
  }
  localStorage.removeItem('rabbitj_api_secrets')
} catch {
  // Storage may be unavailable in restricted browser contexts.
}

export const tokenUser = userStore
export default userStore
