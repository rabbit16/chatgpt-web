import {
  CommentOutlined,
  FileTextOutlined,
  SearchOutlined
} from '@ant-design/icons'
import {
  Button,
  Popconfirm,
  Space,
  Select,
  Input,
  Pagination,
  Spin,
  Switch,
  notification
} from 'antd'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import styles from './index.module.less'
import { chatStore, configStore, userStore, billingNoticeStore } from '@/store'
import { chatAsync } from '@/store/async'
import AllInput from './components/AllInput'
import ChatMessage, { streamTextStore } from './components/ChatMessage'
import DocumentPane, { DocumentPaneHandle } from './components/DocumentPane'
import { ChatGpt, ChatsInfo, RequestChatOptions } from '@/types'
import { postStreamChatCompletions, saveChatMessage, searchChatMessages } from '@/request/api'
import Reminder from '@/components/Reminder'
import {
  extractStreamDelta,
  filterObjectNull,
  formatTime,
  generateUUID,
  normalizeChatList,
  parseBillingNoticeText,
  resolveLlmProtocol,
  sameChatId
} from '@/utils'
import { useScroll } from '@/hooks/useScroll'
import useDocumentResize from '@/hooks/useDocumentResize'
import Layout from '@/components/Layout'
import MarketingBar from '@/components/MarketingBar'
import ExperienceTabs from '@/components/ExperienceTabs'
import useMobile from '@/hooks/useMobile'
import MessageItem from './components/MessageItem'

function parseSseJson(data: string): Record<string, any> | null {
  try {
    const item = JSON.parse(data)
    return item && typeof item === 'object' ? item : null
  } catch {
    return null
  }
}

function commitAssistantMessage(
  chatId: string | number,
  messageId: string,
  info?: { text: string; status: string }
) {
  if (info) chatStore.getState().setChatDataInfo(chatId, messageId, info)
  streamTextStore.getState().clearText(messageId)
}

function CreateChat({ token }: { token?: string }) {
  return (
    <Button
      block
      type="dashed"
      style={{
        marginBottom: 6,
        marginLeft: 0,
        marginRight: 0
      }}
      onClick={() => {
        if (!token) {
          userStore.getState().setLoginModal(true)
          return
        }
        chatStore.getState().addChat()
      }}
    >
      新建对话
    </Button>
  )
}

function ChatPage() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollToBottomIfAtBottom, scrollToBottom, trackScroll } = useScroll(scrollRef)
  const token = userStore((state) => state.token)
  const setLoginModal = userStore((state) => state.setLoginModal)
  const upglobal = userStore((state) => state.upglobal)
  const page = chatStore((state) => state.page)
  const page_num = chatStore((state) => state.page_num)
  const total = chatStore((state) => state.total)
  const changPage = chatStore((state) => state.changPage)
  const updateRepeatedly = chatStore((state) => state.updateRepeatedly)
  const repeatedly = chatStore((state) => state.repeatedly)
  const config = configStore((state) => state.config)
  const models = configStore((state) => state.models)
  const changeConfig = configStore((state) => state.changeConfig)
  const chats = chatStore((state) => state.chats)
  const clearChats = chatStore((state) => state.clearChats)
  const selectChatId = chatStore((state) => state.selectChatId)
  const setChatInfo = chatStore((state) => state.setChatInfo)
  const setChatDataInfo = chatStore((state) => state.setChatDataInfo)
  const delChatMessage = chatStore((state) => state.delChatMessage)
  const upsertChat = chatStore((state) => state.upsertChat)
  const clearLoading = useRef(false)

  const bodyResize = useDocumentResize()

  const isMobile = useMobile()
  /** append=普通对话追加文末；insert=光标续写；none=不同步文稿 */
  const docWriteMode = useRef<'append' | 'insert' | 'none'>('append')
  const docOnlyRef = useRef(false)
  const streamMsgId = useRef('')
  const documentPaneRef = useRef<DocumentPaneHandle | null>(null)
  const [documentOpen, setDocumentOpen] = useState(true)
  const [mobileTab, setMobileTab] = useState<'chat' | 'doc'>('chat')
  const [searchText, setSearchText] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchChats, setSearchChats] = useState<ChatsInfo[]>([])
  const [searchPage, setSearchPage] = useState(1)
  const [searchTotal, setSearchTotal] = useState(0)
  const searchRequestId = useRef(0)
  const searching = Boolean(searchText.trim())
  const isNarrow = bodyResize.width <= 1100

  useLayoutEffect(() => {
    scrollToBottom()
  }, [selectChatId, scrollToBottom])

  // useEffect(() => {
  //   if (token) {
  //     chatAsync.fetchChatMessages()
  //     pluginAsync.fetchGetPlugin()
  //   }
  // }, [token])

  // 当前聊天记录
  const chatMessages = useMemo(() => {
    const chatList = chats.filter((c) => sameChatId(c.id, selectChatId))
    if (chatList.length <= 0) {
      return []
    }
    return chatList[0].data
  }, [selectChatId, chats])

  const documentSeed = useMemo(() => {
    return chatMessages
      .filter((item) => item.role === 'assistant' && item.status === 'pass' && item.text)
      .map((item) => item.text)
      .join('\n\n')
    // 只在切换会话时重算，避免把用户改过的文稿覆盖掉
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectChatId])

  useEffect(() => {
    docWriteMode.current = 'append'
    docOnlyRef.current = false
    streamMsgId.current = ''
  }, [selectChatId])

  // 对接服务端方法
  async function serverChatCompletions({
    requestOptions,
    signal,
    userMessageId,
    assistantMessageId
  }: {
    userMessageId?: string
    signal: AbortSignal
    requestOptions: RequestChatOptions
    assistantMessageId: string
  }) {
    const docOnly = docOnlyRef.current
    const writeMode = docWriteMode.current
    const startedAt = formatTime()
    let accepted = false
    let allContent = ''
    let streamRaf = 0
    let streamProtocol = resolveLlmProtocol(
      requestOptions.options?.model || configStore.getState().config.model
    )

    const publishStream = () => {
      streamRaf = 0
      if (!docOnly) {
        streamTextStore.getState().setText(assistantMessageId, allContent)
        scrollToBottomIfAtBottom()
      }
      if (writeMode !== 'none') documentPaneRef.current?.writeStream(allContent)
    }

    const queueStream = () => {
      if (streamRaf) return
      streamRaf = requestAnimationFrame(publishStream)
    }

    const consumeSsePayload = (data: string) => {
      if (!data) return false
      if (data === '[DONE]') return true
      const item = parseSseJson(data)
      if (!item) return false
      if (item.billing && typeof item.billing === 'object') {
        const billing = item.billing
        billingNoticeStore.getState().show({
          input_tokens: Number(billing.input_tokens) || 0,
          output_tokens: Number(billing.output_tokens) || 0,
          cost: Number(billing.charged ?? billing.cost) || 0,
          balance: Number(billing.remain ?? billing.balance) || 0
        })
      }
      const delta = extractStreamDelta(item, streamProtocol)
      if (delta.error) throw new Error(delta.error)
      if (delta.done) return true
      if (delta.billingText) {
        const notice = parseBillingNoticeText(delta.billingText)
        if (notice) billingNoticeStore.getState().show(notice)
        return false
      }
      if (delta.text) {
        allContent += delta.text
        queueStream()
      }
      return false
    }

    try {
      if (writeMode !== 'none') {
        documentPaneRef.current?.beginWrite(writeMode === 'insert' ? 'insert' : 'append', assistantMessageId)
      }

      const previousMessages = chatStore.getState().chats.find((chat) => sameChatId(chat.id, selectChatId))?.data || []
      const messages = previousMessages
        .filter((message) => message.id !== userMessageId && message.id !== assistantMessageId && (message.role === 'user' || message.role === 'assistant') && message.status === 'pass' && message.text)
        .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.text }))
      messages.push({ role: 'user', content: requestOptions.prompt })
      const model = requestOptions.options?.model || configStore.getState().config.model
      const chatConfig = configStore.getState().config
      const protocol = resolveLlmProtocol(model)
      const response = await postStreamChatCompletions({
        model,
        messages: repeatedly ? messages.slice(-20) : messages.slice(-1),
        stream: true,
        max_tokens: chatConfig.max_tokens
      }, signal)
      if (!response.ok || !response.body) {
        if (response.status === 401) userStore.getState().expireSession()
        const error = await response.text()
        throw new Error(error || `LLM 请求失败 (${response.status})`)
      }
      accepted = true
      if (!docOnly && userMessageId) {
        setChatInfo(selectChatId, {
          id: userMessageId, text: requestOptions.prompt, dateTime: formatTime(),
          status: 'pass', role: 'user', requestOptions
        })
        setChatInfo(selectChatId, {
          id: assistantMessageId, text: '', dateTime: formatTime(),
          status: 'loading', role: 'assistant', requestOptions
        })
        scrollToBottom()
      }
      streamProtocol = (response as Response & { llmProtocol?: typeof protocol }).llmProtocol || protocol
      const reader = response.body.getReader()
      let leftover = ''
      const decoder = new TextDecoder()
      let completed = false
      while (!completed) {
        const { done, value } = await reader.read()
        leftover += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
        const events = leftover.split('\n\n')
        leftover = events.pop() || ''
        for (const event of events) {
          const data = event.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
          if (consumeSsePayload(data)) {
            completed = true
            break
          }
        }
        if (done) break
      }
      if (!completed && leftover) {
        const data = leftover.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
        consumeSsePayload(data)
      }
      if (streamRaf) {
        cancelAnimationFrame(streamRaf)
        streamRaf = 0
      }
      publishStream()
      if (writeMode !== 'none') documentPaneRef.current?.endWrite(allContent)
      if (!docOnly) {
        commitAssistantMessage(selectChatId, assistantMessageId, {
          text: allContent || (signal.aborted ? '已停止回答' : '服务端未返回内容'),
          status: allContent ? 'pass' : 'error'
        })
      }

      // v1 只负责生成；成功后把本轮问答写回旧的上下文库，刷新后还能看到
      if (!docOnly && !signal.aborted && allContent.trim()) {
        const userId = userStore.getState().user_info?.data?.bodyMessage?.userId
        const contextId = requestOptions.parentMessageId || selectChatId
        if (userId && contextId) {
          try {
            await saveChatMessage({
              userId,
              contextId,
              prompt: requestOptions.prompt,
              gpt: allContent,
              mode: model,
              start_time: startedAt,
              answer_time: formatTime()
            })
            // 同步侧边栏标题为最近一句用户问题
            const chat = chatStore.getState().chats.find((item) => sameChatId(item.id, selectChatId))
            if (chat && (!chat.name || chat.name === '新的对话' || chat.name === '标题')) {
              chatStore.getState().setChatInfo(selectChatId, undefined, { name: requestOptions.prompt.slice(0, 40) })
            }
          } catch (error) {
            console.warn('保存对话上下文失败', error)
            notification.warning({
              message: '对话未写入历史',
              description: error instanceof Error ? error.message : '请稍后刷新确认是否保存成功'
            })
          }
        }
      }
      return true
    } catch (error) {
      if (streamRaf) cancelAnimationFrame(streamRaf)
      if (signal.aborted) {
        if (writeMode !== 'none') documentPaneRef.current?.endWrite(allContent)
        if (!docOnly && accepted) {
          commitAssistantMessage(selectChatId, assistantMessageId, {
            text: allContent || '已停止回答',
            status: allContent ? 'pass' : 'error'
          })
        }
        return Boolean(allContent)
      }
      const message = error instanceof Error ? error.message : 'LLM 请求失败'
      notification.error({ message: 'LLM 请求失败', description: message })
      if (!docOnly && (accepted || !userMessageId)) {
        commitAssistantMessage(selectChatId, assistantMessageId, { text: message, status: 'error' })
      }
      if (writeMode !== 'none') documentPaneRef.current?.endWrite('')
      return false
    } finally {
      if (streamRaf) cancelAnimationFrame(streamRaf)
      if (!docOnly) streamTextStore.getState().clearText(assistantMessageId)
      docWriteMode.current = 'append'
      docOnlyRef.current = false
      setFetchController(null)
    }
  }

  const [fetchController, setFetchController] = useState<AbortController | null>(null)

  // 对话；docMode: append=追加文末，insert=光标续写(不进对话)，none=不同步文稿
  async function sendChatCompletions(
    vaule: string,
    refurbishOptions?: ChatGpt,
    options?: { docMode?: 'append' | 'insert' | 'none' }
  ) {
    if (!token) {
      // 不直接弹"登录"，而是引导匿名注册（不用手机号），保住体验连续性
      userStore.getState().openAnonSignup()
      return false
    }

    const docMode = options?.docMode ?? 'append'
    docWriteMode.current = docMode
    docOnlyRef.current = docMode === 'insert'
    const docOnly = docOnlyRef.current

    const selectChat = chats.find((c) => sameChatId(c.id, selectChatId))
    if (!selectChat) return false

    const parentMessageId = refurbishOptions?.requestOptions?.parentMessageId || selectChat.id
    let userMessageId = generateUUID()
    const requestOptions = {
      prompt: vaule,
      parentMessageId,
      options: filterObjectNull({
        ...config,
        ...refurbishOptions?.requestOptions?.options
      })
    }
    const assistantMessageId = refurbishOptions?.id || generateUUID()
    streamMsgId.current = assistantMessageId
    if (!docOnly) {
      streamTextStore.getState().clearText(String(assistantMessageId))
      if (refurbishOptions?.requestOptions?.parentMessageId && refurbishOptions?.id) {
        userMessageId = ''
        setChatDataInfo(selectChatId, assistantMessageId, {
          status: 'loading',
          role: 'assistant',
          text: '',
          dateTime: formatTime(),
          requestOptions
        })
      }
      scrollToBottom()
    }
    clearLoading.current = false
    const controller = new AbortController()
    const signal = controller.signal
    setFetchController(controller)
    return serverChatCompletions({
      requestOptions,
      signal,
      userMessageId: docOnly ? undefined : userMessageId,
      assistantMessageId
    })
  }

  useEffect(() => {
    const requestId = ++searchRequestId.current
    const keyword = searchText.trim()
    if (!keyword || !token) {
      setSearchChats([])
      setSearchTotal(0)
      setSearchLoading(false)
      return
    }
    setSearchLoading(true)
    setSearchChats([])
    const timer = window.setTimeout(async () => {
      try {
        const userId = userStore.getState().user_info?.data?.bodyMessage?.userId
        if (!userId) throw new Error('缺少 userId')
        const response = await searchChatMessages({ userId: Number(userId), keyword, page: searchPage, page_num })
        if (requestId !== searchRequestId.current) return
        const payload = response.data
        if (String(payload?.code) !== '0' || !Array.isArray(payload?.context_dict)) {
          throw new Error(payload?.codeMsg || '搜索接口未返回有效结果')
        }
        const count = Number(payload.total) || 0
        setSearchTotal(count)
        if (count > 0 && searchPage > Math.ceil(count / page_num)) {
          setSearchPage(Math.ceil(count / page_num))
          return
        }
        setSearchChats(normalizeChatList(payload))
      } catch (error) {
        if (requestId !== searchRequestId.current) return
        notification.error({ message: '搜索失败', description: error instanceof Error ? error.message : '请稍后重试' })
      } finally {
        if (requestId === searchRequestId.current) setSearchLoading(false)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchText, searchPage, token, page_num, upglobal])

  function handleContinueLine(prompt: string) {
    if (!prompt || fetchController) return
    documentPaneRef.current?.getCursorIndex()
    setDocumentOpen(true)
    if (isNarrow) setMobileTab('doc')
    sendChatCompletions(prompt, undefined, { docMode: 'insert' })
  }

  // 翻页
  function onChange(e: number) {
    if (searching) setSearchPage(e)
    else changPage(e)
  }
  return (
    <div className={styles.chatPage}>
      <Layout
        keepSiderWhenMenuEmpty={searching}
        menuExtraRender={() => (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <CreateChat token={token} />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索全部对话"
              value={searchText}
              onChange={(event) => {
                setSearchPage(1)
                setSearchText(event.target.value)
              }}
            />
            {searching && searchLoading && <Spin size="small" />}
            {searching && !searchLoading && searchTotal === 0 && (
              <span style={{ color: '#999', fontSize: 12 }}>没有找到匹配的对话</span>
            )}
          </Space>
        )}
        route={{
          path: '/',
          routes: searching ? searchChats : chats
        }}
        menuDataRender={(item) => {
          return item
        }}
        menuItemRender={(item, dom) => {
          return (
            <div>
              <MessageItem
                id={item.id}
                isSelect={sameChatId(item.id, selectChatId)}
                isPersona={false}
                name={item.name}
                onSelect={searching ? () => {
                  const chat = searchChats.find((entry) => sameChatId(entry.id, item.id))
                  if (chat) upsertChat(chat)
                  if (isNarrow) setMobileTab('chat')
                } : undefined}
                onConfirm={() => {
                  chatAsync.fetchDelUserMessagesList({ id: item.id }).then(() => {
                    if (searching) {
                      setSearchChats((items) => items.filter((entry) => !sameChatId(entry.id, item.id)))
                      setSearchTotal((count) => Math.max(0, count - 1))
                      userStore.getState().upDataGlobal()
                    }
                  })
                }}
              />
            </div>
          )
        }}
        menuFooterRender={(props) => {
          return (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Pagination simple current={searching ? searchPage : page} pageSize={page_num} onChange={onChange} total={searching ? searchTotal : total} />
              <Select
                size="middle"
                style={{ width: '100%' }}
                defaultValue={config.model}
                value={config.model}
                options={models.map((m) => ({ ...m, label: '模型(点击选择): ' + m.label }))}
                onChange={(e) => {
                  changeConfig({
                    ...config,
                    model: e.toString()
                  })
                }}
              />
              <Popconfirm
                title="删除全部对话"
                description="您确定删除全部会话对吗? "
                onConfirm={() => {
                  if (token) {
                    // chatAsync.fetchDelUserMessages({ type: 'delAll' })
                    chatAsync.fetchDelUserMessagesListAll()
                    chatStore.getState().changeChatMessage([])
                  } else {
                    clearChats()
                  }
                }}
                onCancel={() => {
                  // ==== 无操作 ====
                }}
                okText="Yes"
                cancelText="No"
              >
                <Button block danger type="dashed" ghost>
                  清除所有对话
                </Button>
              </Popconfirm>
            </Space>
          )
        }}
      >
        <div className={styles.chatPage_container}>
          {!token && <MarketingBar onRegister={() => setLoginModal(true)} />}
          <ExperienceTabs />
          <div className={styles.chatPage_container_toolbar}>
            {isNarrow ? (
              <Button.Group>
                <Button
                  type={mobileTab === 'chat' ? 'primary' : 'default'}
                  icon={<CommentOutlined />}
                  onClick={() => setMobileTab('chat')}
                >
                  对话
                </Button>
                <Button
                  type={mobileTab === 'doc' ? 'primary' : 'default'}
                  icon={<FileTextOutlined />}
                  onClick={() => setMobileTab('doc')}
                >
                  文稿
                </Button>
              </Button.Group>
            ) : (
              <Button
                icon={<FileTextOutlined />}
                onClick={() => setDocumentOpen((open) => !open)}
              >
                {documentOpen ? '收起文稿' : '展开文稿'}
              </Button>
            )}
          </div>
          <div className={styles.chatPage_container_workspace}>
            <div
              className={styles.chatPage_container_main}
              style={{ display: !isNarrow || mobileTab === 'chat' ? undefined : 'none' }}
            >
                <div ref={scrollRef} className={styles.chatPage_container_one} onScroll={trackScroll}>
                  <div id="image-wrapper">
                    {chatMessages.map((item) => {
                      return (
                        <ChatMessage
                          key={item.id || `${item.role}-${item.dateTime}`}
                          streamId={item.id ? String(item.id) : undefined}
                          position={item.role === 'user' ? 'right' : 'left'}
                          status={item.status}
                          content={item.text}
                          time={item.dateTime}
                          model={item.requestOptions?.options?.model}
                          onDelChatMessage={() => {
                            delChatMessage(selectChatId, item.id)
                          }}
                          onRefurbishChatMessage={() => {
                            sendChatCompletions(item.requestOptions?.prompt || item.text, item)
                          }}
                        />
                      )
                    })}
                    {chatMessages.length <= 0 && <Reminder />}
                    <div style={{ height: 100 }} />
                  </div>
                </div>
                <div
                  className={styles.chatPage_container_two}
                  style={{
                    position: isMobile ? 'fixed' : 'absolute'
                  }}
                >
                  <div className={styles.chatPage_container_two_title}>
                    开启记忆模式:
                    <Switch
                      checkedChildren="开"
                      unCheckedChildren="关"
                      checked={repeatedly}
                      onChange={(e) => updateRepeatedly(e)}
                    />
                  </div>
                  <AllInput
                    disabled={!!fetchController}
                    onSend={async (value) => {
                      if (value.startsWith('/')) return false
                      const sent = await sendChatCompletions(value)
                      if (sent) scrollToBottomIfAtBottom()
                      return sent
                    }}
                    clearMessage={() => {
                      if (token) {
                        chatAsync.fetchDelUserMessages({ id: selectChatId, type: 'clear' })
                      } else {
                        setLoginModal(true)
                      }
                    }}
                    onStopFetch={() => {
                      setFetchController((c) => {
                        c?.abort()
                        clearLoading.current = true
                        return null
                      })
                    }}
                  />
                </div>
            </div>
            <div
              style={{
                display:
                  (!isNarrow && documentOpen) || (isNarrow && mobileTab === 'doc') ? undefined : 'none',
                height: '100%',
                width: isNarrow ? '100%' : '42%',
                minWidth: isNarrow ? 0 : 320,
                maxWidth: isNarrow ? 'none' : 560,
                flexShrink: 0
              }}
            >
              <DocumentPane
                ref={documentPaneRef}
                key={String(selectChatId || '')}
                chatId={selectChatId}
                initialText={documentSeed}
                disabled={!!fetchController}
                onContinue={handleContinueLine}
              />
            </div>
          </div>
        </div>
      </Layout>
    </div>
  )
}
export default ChatPage
