import {
  CommentOutlined,
  DeleteOutlined,
  GitlabFilled,
  RedditCircleFilled,
  RedditSquareFilled
} from '@ant-design/icons'
import {
  Button,
  Modal,
  Popconfirm,
  Space,
  Tabs,
  Select,
  message,
  Badge,
  Pagination,
  Switch
} from 'antd'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import styles from './index.module.less'
import { chatStore, configStore, userStore } from '@/store'
import { chatAsync, pluginAsync } from '@/store/async'
import RoleNetwork from './components/RoleNetwork'
import RoleLocal from './components/RoleLocal'
import AllInput from './components/AllInput'
import ChatMessage from './components/ChatMessage'
import { notification } from 'antd'
import { ChatGpt, RequestChatOptions } from '@/types'
import { postChatCompletions, postStreamChatCompletions } from '@/request/api'
import Reminder from '@/components/Reminder'
import {
  filterObjectNull,
  formatTime,
  generateUUID,
  handleChatData,
  analyzeChatData
} from '@/utils'
import { useScroll } from '@/hooks/useScroll'
import useDocumentResize from '@/hooks/useDocumentResize'
import Layout from '@/components/Layout'
import useMobile from '@/hooks/useMobile'
import PersonaModal from '@/components/PersonaModal'
import PluginModal from '@/components/pluginModal'
import MessageItem from './components/MessageItem'

function ChatPage() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { scrollToBottomIfAtBottom, scrollToBottom } = useScroll(scrollRef.current)
  const { token, setLoginModal } = userStore()
  const { page, page_num, total, changPage, updateRepeatedly, repeatedly } = chatStore()
  const { config, models, changeConfig, setConfigModal } = configStore()
  const clearLoading = useRef(false)
  const {
    chats,
    addChat,
    delChat,
    clearChats,
    selectChatId,
    changeSelectChatId,
    setChatInfo,
    setChatDataInfo,
    clearChatMessage,
    delChatMessage
  } = chatStore()

  const bodyResize = useDocumentResize()

  const isMobile = useMobile()

  useLayoutEffect(() => {
    if (scrollRef) {
      scrollToBottom()
    }
  }, [scrollRef.current, selectChatId, chats])

  // useEffect(() => {
  //   if (token) {
  //     chatAsync.fetchChatMessages()
  //     pluginAsync.fetchGetPlugin()
  //   }
  // }, [token])

  // 当前聊天记录
  const chatMessages = useMemo(() => {
    const chatList = chats.filter((c) => c.id === selectChatId)
    if (chatList.length <= 0) {
      return []
    }
    return chatList[0].data
  }, [selectChatId, chats])

  // 创建对话按钮
  const CreateChat = () => {
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
            setLoginModal(true)
            return
          }
          addChat()
        }}
      >
        新建对话
      </Button>
    )
  }

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
    // console.log(requestOptions);
    // "contextId": "string",
    // "withoutContext": true,
    // "prompt": "string",
    // "userId": 0
    if (false) {
      try {
        const response = await postChatCompletions(
          {
            contextId: chatStore.getState().selectChatId,
            withoutContext: false,
            prompt: requestOptions.prompt,
            userId: userStore.getState().user_info?.data?.bodyMessage?.userId,
            mode: configStore.getState().config.model
          },
          signal
        )
        let data = await response.json()

        setChatDataInfo(selectChatId, assistantMessageId, {
          status: 'pass',
          text: `${data?.gptResult[0]?.gpt}`
        })
      } catch (e) {
        setChatDataInfo(selectChatId, assistantMessageId, {
          status: 'pass',
          text: clearLoading ? '已取消' : `请求超时请重试`
        })
      }
      fetchController?.abort()
      setFetchController(null)
      // message.error('请求失败')
      return
    } else {
      const response = await postStreamChatCompletions(
        {
          contextId: chatStore.getState().selectChatId,
          withoutContext: repeatedly,
          prompt: requestOptions.prompt,
          userId: userStore.getState().user_info?.data?.bodyMessage?.userId,
          mode: configStore.getState().config.model
        },
        signal
      )
        .then((res) => {
          return res
        })
        .catch((error) => {
          // 终止： AbortError
          console.log(error.name)
        })

      // if (!(response instanceof Response)) {
      //   // 这里返回是错误 ...
      //   if (userMessageId) {
      //     setChatDataInfo(selectChatId, userMessageId, {
      //       status: 'error'
      //     })
      //   }

      //   setChatDataInfo(selectChatId, assistantMessageId, {
      //     status: 'error',
      //     text: `${response?.message || '❌ 请求异常，请稍后在尝试。'} \n \`\`\` ${JSON.stringify(response, null, 2)}   `
      //   })
      //   fetchController?.abort()
      //   setFetchController(null)
      //   message.error('请求失败')
      //   return
      // }
      console.log(response)
      // let reader = response?.body?.pipeThrough(new TextDecoderStream())?.getReader();
      // console.log(reader);

      // while (true) {
      //   var { value, done } = await reader.read();
      //   console.log(value,done);
      //   console.log(value?.split('$_$').slice(0,-1).forEach(value=>console.log(JSON.parse(value)))
      //   );

      //   if (done) break;
      //   value = value?.replace('undefined', '')
      //   console.log("received data -", value)
      //   output.value += value?.replace('undefined', '')
      // }
      // return

      const reader = response.body?.getReader()
      let allContent = ''
      while (true) {
        const { done, value } = (await reader?.read()) || {}
        console.log(done, value, '>>>')

        if (done) {
          fetchController?.abort()
          setFetchController(null)
          break
        }
        // 将获取到的数据片段显示在屏幕上
        const text = new TextDecoder('utf-8').decode(value)
        console.log(text, '<<<<<', text.split('$_$'))

        const texts = analyzeChatData(text)
        console.log(texts)
        let flag = 0;
        for (let i = 0; i < texts.length; i++) {
          flag = 1;
          const { choices } = texts[i]
          const {
            finish_reason = '',
            delta: { content }
          } = choices[0]
          allContent += content ? content : ''
          if (finish_reason === 'stop') {
            setFetchController(null)
            setChatDataInfo(selectChatId, assistantMessageId, {
              text: allContent,
              status: 'pass'
            })
            break
          }
          if (finish_reason === null) {
            setChatDataInfo(selectChatId, assistantMessageId, {
              text: allContent,
              status: 'pass'
            })
          }
        }
        if (flag == 0){
          notification.error({
            message: '错误',
            description: '用户状态过期',
            style: {
              top: 60,
              zIndex: 1011
            }
          })
          userStore.getState().logout()
          chatStore.getState().clearChats()
        }
        scrollToBottomIfAtBottom()
      }
    }
  }

  const [fetchController, setFetchController] = useState<AbortController | null>(null)

  // 对话
  async function sendChatCompletions(vaule: string, refurbishOptions?: ChatGpt) {
    if (!token) {
      setLoginModal(true)
      return
    }

    const selectChat = chats.filter((c) => c.id === selectChatId)[0]

    const parentMessageId = refurbishOptions?.requestOptions.parentMessageId || selectChat.id
    let userMessageId = generateUUID()
    const requestOptions = {
      prompt: vaule,
      parentMessageId,
      persona_id: selectChat?.persona_id || refurbishOptions?.persona_id || '',
      options: filterObjectNull({
        ...config,
        ...refurbishOptions?.requestOptions.options
      })
    }
    const assistantMessageId = refurbishOptions?.id || generateUUID()
    if (refurbishOptions?.requestOptions.parentMessageId && refurbishOptions?.id) {
      userMessageId = ''
      setChatDataInfo(selectChatId, assistantMessageId, {
        status: 'loading',
        role: 'assistant',
        text: '',
        dateTime: formatTime(),
        requestOptions
      })
    } else {
      setChatInfo(selectChatId, {
        id: userMessageId,
        text: vaule,
        dateTime: formatTime(),
        status: 'pass',
        role: 'user',
        requestOptions
      })
      setChatInfo(selectChatId, {
        id: assistantMessageId,
        text: '',
        dateTime: formatTime(),
        status: 'loading',
        role: 'assistant',
        requestOptions
      })
    }
    clearLoading.current = false
    const controller = new AbortController()
    const signal = controller.signal
    setFetchController(controller)
    serverChatCompletions({
      requestOptions,
      signal,
      userMessageId,
      assistantMessageId
    })
  }
  // 翻页
  function onChange(e: any) {
    changPage(e)
  }
  return (
    <div className={styles.chatPage}>
      <Layout
        menuExtraRender={() => <CreateChat />}
        route={{
          path: '/',
          routes: chats
        }}
        menuDataRender={(item) => {
          return item
        }}
        menuItemRender={(item, dom) => {
          return (
            <div>
              <MessageItem
                id={item.id}
                isSelect={item.id === selectChatId}
                isPersona={!!item.persona_id}
                name={item.name}
                onConfirm={() => {
                  chatAsync.fetchDelUserMessagesList({ id: item.id })
                }}
              />
            </div>
          )
        }}
        menuFooterRender={(props) => {
          return (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Pagination simple current={page} onChange={onChange} total={total} />
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
          {chatMessages[0]?.persona_id && (
            <div className={styles.chatPage_container_persona}>当前为预置角色对话</div>
          )}
          <div ref={scrollRef} className={styles.chatPage_container_one}>
            <div id="image-wrapper">
              {chatMessages.map((item) => {
                return (
                  <ChatMessage
                    key={item.dateTime + item.role + item.text}
                    position={item.role === 'user' ? 'right' : 'left'}
                    status={item.status}
                    content={item.text}
                    time={item.dateTime}
                    model={item.requestOptions.options?.model}
                    onDelChatMessage={() => {
                      delChatMessage(selectChatId, item.id)
                    }}
                    onRefurbishChatMessage={() => {
                      console.log(item)
                      sendChatCompletions(item.requestOptions.prompt, item)
                    }}
                    pluginInfo={item.plugin_info}
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
              onSend={(value) => {
                if (value.startsWith('/')) return
                sendChatCompletions(value)
                scrollToBottomIfAtBottom()
              }}
              clearMessage={() => {
                if (token) {
                  chatAsync.fetchDelUserMessages({ id: selectChatId, type: 'clear' })
                } else {
                  setLoginModal(true)
                }
              }}
              onStopFetch={() => {
                // 结束
                setFetchController((c) => {
                  c?.abort()
                  clearLoading.current = true
                  return null
                })
              }}
            />
          </div>
        </div>
      </Layout>
    </div>
  )
}
export default ChatPage
