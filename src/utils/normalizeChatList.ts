import { ChatsInfo } from '@/types'

export function normalizeChatList(payload: any): ChatsInfo[] {
  const raw =
    payload?.context_dict ||
    payload?.data?.context_dict ||
    (Array.isArray(payload) ? payload : []) ||
    []
  return (Array.isArray(raw) ? raw : [])
    .filter((value) => value && (value.id != null || value.path != null))
    .map((value: any) => {
      const messages = Array.isArray(value.data) ? value.data : []
      const userMessages = messages.filter((item: any) => item?.role === 'user')
      const lastUser =
        userMessages.length > 0
          ? userMessages[userMessages.length - 1]?.text || '新的对话'
          : value.name || '新的对话'
      const id = String(value.id ?? value.path)
      return {
        ...value,
        id,
        path: id,
        name: lastUser,
        data: messages
      }
    })
}
