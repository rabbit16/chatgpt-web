import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { ChatGpt, ChatsInfo } from '@/types'
import { formatTime, generateChatInfo, sameChatId } from '@/utils'
import { addUserMessages } from '../../request/api'
import userStore from '../user/slice'
export interface ChatState {
  // 聊天对话
  chats: Array<ChatsInfo>
  // 当前选择的会话id
  selectChatId: string | number
  page:number,
  page_num:number,
  total:number,
  repeatedly:boolean
  // 新增一个对话
  addChat: (value?: { persona_id?: number | string; name?: string }) => void
  // 删除一个对话
  delChat: (id: string | number) => void
  // 清空所有对话
  clearChats: () => void
  // 改变选择会话ID
  changeSelectChatId: (id: string | number) => void
  // 给对话添加数据
  setChatInfo: (
    id: string | number,
    data?: ChatGpt,
    info?: ChatsInfo | { [key: string]: any }
  ) => void
  // 修改对话数据
  setChatDataInfo: (
    id: string | number,
    messageId: string | number,
    info?: ChatGpt | { [key: string]: any }
  ) => void
  // 清理当前会话
  clearChatMessage: (id: string | number) => void
  // 删除某条消息
  delChatMessage: (id: string | number, messageId: string | number) => void
  // 重置
  changeChatMessage: (data: Array<ChatsInfo>) => void
  // 初始化列表
  getAllChatList: (data: any,id:any) => void
  // 搜索跳转时写入/更新会话，确保不在当前页也能打开
  upsertChat: (chat: ChatsInfo) => void
  setPage:(value:number,total:number)=>void
  changPage:(value:number)=>void
  updateRepeatedly:(value:boolean)=>void
}

const chatStore = create<ChatState>()(
  // persist(
  (set) => ({
    chats: [],
    page:1,
    page_num:10,
    total:0,
    selectChatId: '',
    repeatedly:true,
    // 初始化
    setPage:(total:number) =>{
      set({total})
    },
    updateRepeatedly:(value:boolean)=>{
      set({repeatedly:value})
    },
    //翻页
    changPage:(value:number)=>{
      set({page:value})
    },
    // 获取全部的gpt列表
    getAllChatList: async (value:any,id:any) => {
      set((state)=>{
        return {
          chats:[...value],
          selectChatId: String(id || '')
        }
      })
    },
    upsertChat: (chat) =>
      set((state: ChatState) => {
        const id = String(chat.id)
        const exists = state.chats.some((item) => sameChatId(item.id, id))
        return {
          chats: exists
            ? state.chats.map((item) =>
                sameChatId(item.id, id)
                  ? {
                      ...item,
                      ...chat,
                      id,
                      path: id,
                      data: Array.isArray(chat.data) ? chat.data : item.data
                    }
                  : item
              )
            : [{ ...chat, id, path: id }, ...state.chats],
          selectChatId: id
        }
      }),
    addChat: async (value) => {
      let res = await addUserMessages({ userId: userStore.getState().user_info?.data?.bodyMessage?.userId })
      let id = String(res?.data?.newChatId || '')
      if (!id || id === 'undefined') return
      set((state: ChatState) => {
        let info = generateChatInfo(value)
        info.id = id
        info.path = id
        const onFirstPage = state.page === 1
        return {
          chats: onFirstPage ? [{ ...info }, ...state.chats] : [{ ...info }],
          selectChatId: id,
          page: 1,
          total: state.total + 1
        }
      })
    },
    delChat: (id) =>
      set((state: ChatState) => {
        const newChats = state.chats.filter((c) => !sameChatId(c.id, id))
        if (newChats.length <= 0) {
          // 删光后不要留下空侧边栏；占位会话会在下次拉取/新建时被替换
          const info = generateChatInfo()
          return {
            chats: [{ ...info }],
            selectChatId: info.id
          }
        }
        const nextId = String(newChats[0].id)
        return {
          selectChatId: sameChatId(state.selectChatId, id) ? nextId : String(state.selectChatId),
          chats: [...newChats]
        }
      }),
    clearChats: () =>
      set(() => {
        const info = generateChatInfo()
        return {
          chats: [{ ...info }],
          selectChatId: info.id
        }
      }),
    changeSelectChatId: (id) =>
      set(() => ({
        selectChatId: String(id)
      })),
    changeChatMessage: (data) => set({ chats: data }),
    delChatMessage: (id, messageId) =>
      set((state: ChatState) => {
        const newChats = state.chats.map((c) => {
          if (sameChatId(c.id, id)) {
            const newData = c.data.filter((d) => !sameChatId(d.id, messageId))
            return {
              ...c,
              data: newData
            }
          }
          return c
        })
        return {
          chats: newChats
        }
      }),
    clearChatMessage: (id) =>
      set((state: ChatState) => {
        const newChats = state.chats.map((c) => {
          if (sameChatId(c.id, id)) {
            return {
              ...c,
              parentMessageId: '',
              data: [],
              text: '',
              dateTime: formatTime()
            }
          }
          return c
        })
        return {
          chats: newChats
        }
      }),
    setChatInfo: (id, data, info) =>
      set((state: ChatState) => {
        const newChats = state.chats.map((item) => {
          if (sameChatId(item.id, id)) {
            const name = item.data.length <= 0 && data?.text ? data.text : item.name
            return {
              ...item,
              name,
              ...info,
              data: data ? item.data.concat({ ...data }) : item.data
            }
          }
          return item
        })
        return {
          chats: newChats
        }
      }),
    setChatDataInfo: (id, messageId, info) =>
      set((state: ChatState) => {
        const newChats = state.chats.map((item) => {
          if (sameChatId(item.id, id)) {
            const newData = item.data.map((m) => {
              if (sameChatId(m.id, messageId)) {
                return {
                  ...m,
                  ...info
                }
              }
              return m
            })

            const dataFilter = newData.filter((d) => sameChatId(d.id, messageId))
            const chatData = { id: messageId, ...info } as ChatGpt
            return {
              ...item,
              data: dataFilter.length <= 0 ? [...newData, { ...chatData }] : [...newData]
            }
          }
          return item
        })

        return {
          chats: newChats
        }
      })
  }),
)

export default chatStore
