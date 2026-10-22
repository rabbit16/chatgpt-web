import { chatStore, configStore, paymentStore } from '@/store'
import { configAsync } from '@/store/async'
import { useEffect, useLayoutEffect } from 'react'
import LoginModal from '../LoginModal'
import ConfigModal from '../ConfigModal'
import AnnouncementPopup from '../AnnouncementPopup'
import { userStore } from '@/store'
import { notification } from 'antd'
import React from 'react'
import { getGPTListMessage, getSession } from '../../request/api'
import { syncCredential } from '@/utils/llmCredential'
import { normalizeChatList, sanitizeHtml } from '@/utils'

type Props = {
  children: React.ReactElement
}

function readUserId() {
  const info = userStore.getState().user_info as any
  return (
    info?.data?.bodyMessage?.userId ??
    info?.bodyMessage?.userId ??
    info?.data?.userId ??
    info?.userId
  )
}

function Global(props: Props) {
  const models = configStore((state) => state.models)
  const config = configStore((state) => state.config)
  const configModal = configStore((state) => state.configModal)
  const changeConfig = configStore((state) => state.changeConfig)
  const setConfigModal = configStore((state) => state.setConfigModal)
  const notifications = configStore((state) => state.notifications)
  const addChat = chatStore((state) => state.addChat)
  const getAllChatList = chatStore((state) => state.getAllChatList)
  const page = chatStore((state) => state.page)
  const page_num = chatStore((state) => state.page_num)
  const setPage = chatStore((state) => state.setPage)
  const changPage = chatStore((state) => state.changPage)
  const token = userStore((state) => state.token)
  const loginModal = userStore((state) => state.loginModal)
  const setLoginModal = userStore((state) => state.setLoginModal)
  const upglobal = userStore((state) => state.upglobal)

  const openNotification = ({
    key,
    title,
    content
  }: {
    key: string | number
    title: string
    content: string
  }) => {
    return notification.open({
      key,
      message: title,
      description: (
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(content)
          }}
        />
      ),
    })
  }

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function onOpenNotifications() {
    for (const item of notifications) {
      await openNotification({
        key: item.id,
        title: item.title,
        content: item.content
      })
      await delay(500)
    }
  }

  // 支付通道以后端全局配置为准，启动时同步一次。
  // 用裸 fetch 而不是 request，避免后端尚未上线时被 3004 拦截器弹登录框。
  useEffect(() => {
    let cancelled = false
    const base = import.meta.env.VITE_APP_REQUEST_HOST || ''
    fetch(`${base}/user/pay/channel`, { method: 'GET' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || String(payload.code) !== '0' || !payload.channel) return
        paymentStore.getState().setFromServer({
          channel: payload.channel,
          channels: payload.channels
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    getSession()
      .then((res: any) => {
        if (cancelled) return
        const body = res?.data?.bodyMessage
        if (!body || String(res?.data?.code) !== '0') return
        const current = userStore.getState().user_info as any
        if (!current) return
        const isStaff = Boolean(body.is_staff)
        const next = {
          ...current,
          role: isStaff ? 'administrator' : 'user'
        }
        if (current.data) {
          next.data = {
            ...current.data,
            bodyMessage: {
              ...(current.data.bodyMessage || {}),
              ...body,
              is_staff: isStaff
            }
          }
        }
        if (current.bodyMessage) {
          next.bodyMessage = {
            ...current.bodyMessage,
            ...body,
            is_staff: isStaff
          }
        }
        userStore.setState({ user_info: next })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const base = import.meta.env.VITE_APP_REQUEST_HOST || ''
    fetch(`${base}/user/api_key/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        token: userStore.getState().token || ''
      },
      body: '{}'
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || String(payload.code) !== '0') return
        const nextKey = syncCredential(
          userStore.getState().user_info,
          Boolean(payload.allow_phone_key),
          payload.keys || []
        )
        userStore.getState().setLlmAccess({
          llm_api_key: nextKey,
          allow_phone_key: Boolean(payload.allow_phone_key)
        })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const userId = readUserId()
      if (!userId) {
        console.warn('对话列表未加载：缺少 userId')
        return
      }

      try {
        const data: any = await getGPTListMessage({
          userId,
          page,
          page_num,
          allContext: false
        })
        if (cancelled) return

        const payload = data?.data ?? data ?? {}
        const list = normalizeChatList(payload)
        const total = Number(payload?.allContextNum ?? payload?.data?.allContextNum ?? 0) || 0

        configAsync.fetchGetModelList().catch((error) => {
          console.warn('获取模型列表失败', error)
        })

        if (list.length <= 0) {
          // 空页不要先把现有列表清掉，否则侧边栏会闪空/卡空
          if (page > 1) {
            setPage(total)
            changPage(page - 1)
            return
          }
          setPage(total)
          await addChat()
          return
        }

        const prevId = String(chatStore.getState().selectChatId || '')
        const keepId = list.some((item: any) => String(item.id) === prevId) ? prevId : list[0].id
        getAllChatList(list, keepId)
        setPage(total)
      } catch (error) {
        console.error('获取对话列表失败', error)
      }
    }

    if (token) {
      init()
    }

    return () => {
      cancelled = true
    }
    // configAsync.fetchConfig()
  }, [token, upglobal, page])

  useLayoutEffect(() => {
    onOpenNotifications()
  }, [notification])

  return (
    <>
      {props.children}
      <LoginModal
        open={loginModal}
        onCancel={() => {
          setLoginModal(false)
        }}
      />
      <AnnouncementPopup />
      <ConfigModal
        open={configModal}
        onCancel={() => {
          setConfigModal(false)
        }}
        models={models}
        onChange={changeConfig}
        data={config}
      />
    </>
  )
}
export default Global
