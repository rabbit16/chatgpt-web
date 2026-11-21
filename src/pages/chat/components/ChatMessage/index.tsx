import rabbitLogo from '@/assets/brand/rabbitj-a2.svg'
import React, { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { create } from 'zustand'
import { copyToClipboard, joinTrim } from '@/utils'
import { renderMarkdown } from '@/utils/renderMarkdown'
import styles from './index.module.less'
import { Dropdown, message } from 'antd'
import 'katex/dist/katex.min.css'
import { CopyOutlined, DeleteOutlined, MoreOutlined, RedoOutlined } from '@ant-design/icons'
import avatarIcon from '@/assets/avatar.png'

const ASSISTANT_MARK = rabbitLogo

const dropdownItems = [
  {
    icon: <CopyOutlined />,
    label: '复制',
    key: 'copyout'
  },
  {
    icon: <RedoOutlined />,
    label: '重试',
    key: 'refurbish'
  },
  {
    icon: <DeleteOutlined />,
    label: '删除',
    key: 'delete'
  }
]

function screenDropdownItems(status: string, position: 'left' | 'right') {
  return dropdownItems.filter((item) => {
    if (status !== 'error' && item.key === 'delete') {
      return false
    }
    if (position !== 'left' && item.key === 'refurbish') {
      return false
    }
    return true
  })
}

type StreamTextState = {
  textById: Record<string, string>
  setText: (id: string, text: string) => void
  clearText: (id: string) => void
}

export const streamTextStore = create<StreamTextState>((set) => ({
  textById: {},
  setText: (id, text) => set((state) => ({ textById: { ...state.textById, [id]: text } })),
  clearText: (id) => set((state) => {
    if (!(id in state.textById)) return state
    const textById = { ...state.textById }
    delete textById[id]
    return { textById }
  })
}))

function ChatMessage({
  streamId,
  position,
  content,
  status,
  time,
  model,
  onDelChatMessage,
  onRefurbishChatMessage,
  isSearchTarget = false
}: {
  streamId?: string
  position: 'left' | 'right'
  content?: string
  status: 'pass' | 'loading' | 'error' | string
  time: string
  model?: string
  onDelChatMessage?: () => void
  onRefurbishChatMessage?: () => void
  isSearchTarget?: boolean
}) {
  const copyMessageKey = 'copyMessageKey'
  const markdownBodyRef = useRef<HTMLDivElement>(null)
  const liveText = streamTextStore((state) => (streamId ? state.textById[streamId] : undefined))
  const displayText = liveText ?? content ?? ''
  const streaming = status === 'loading'

  function onCopyOut(text: string) {
    copyToClipboard(text)
      .then(() => {
        message.open({
          key: copyMessageKey,
          type: 'success',
          content: '复制成功'
        })
      })
      .catch(() => {
        message.open({
          key: copyMessageKey,
          type: 'error',
          content: '复制失败'
        })
      })
  }

  function addCopyEvents() {
    if (markdownBodyRef.current) {
      const copyBtn = markdownBodyRef.current.querySelectorAll('.code-block-header__copy')
      copyBtn.forEach((btn) => {
        btn.addEventListener('click', () => {
          const code = btn.parentElement?.nextElementSibling?.textContent
          if (code) {
            onCopyOut(code)
          }
        })
      })
    }
  }

  function removeCopyEvents() {
    if (markdownBodyRef.current) {
      const copyBtn = markdownBodyRef.current.querySelectorAll('.code-block-header__copy')
      copyBtn.forEach((btn) => {
        btn.replaceWith(btn.cloneNode(true))
      })
    }
  }

  const renderText = useMemo(() => {
    if (position === 'right') {
      return (
        <div ref={markdownBodyRef} className="markdown-body">
          {displayText}
        </div>
      )
    }
    return (
      <div
        ref={markdownBodyRef}
        className="markdown-body"
        dangerouslySetInnerHTML={{
          __html: renderMarkdown(displayText, streaming)
        }}
        data-pos={position}
      />
    )
  }, [displayText, position, streaming])

  useLayoutEffect(() => {
    addCopyEvents()
    return () => {
      removeCopyEvents()
    }
  }, [displayText])

  function chatAvatar({
    isShow,
    icon,
    style
  }: {
    isShow: boolean
    icon: string
    style?: React.CSSProperties
  }) {
    if (!isShow) return null
    return (
      <div className={styles.chatMessage_avatarCard} style={style}>
        <img src={icon} alt="" />
      </div>
    )
  }

  return (
    <div
      id={isSearchTarget ? 'chat-search-target' : undefined}
      className={styles.chatMessage}
      style={{
        justifyContent: position === 'right' ? 'flex-end' : 'flex-start'
      }}
    >
      {chatAvatar({
        style: { marginRight: 8 },
        isShow: position === 'left',
        icon: ASSISTANT_MARK
      })}
      <div className={styles.chatMessage_content}>
        <span
          className={styles.chatMessage_content_time}
          style={{
            textAlign: position === 'right' ? 'right' : 'left'
          }}
        >
          {time}
        </span>
        <div
          className={joinTrim([
            styles.chatMessage_content_text,
            position === 'right' ? styles.right : styles.left
          ])}
        >
          {status === 'loading' && !displayText ? (
            <div className={styles.thinking} role="status">
              <span>rabbitJ 正在思考</span>
              <span className={styles.thinkingDots} aria-hidden="true"><i /><i /><i /></span>
            </div>
          ) : renderText}
        </div>
        {!streaming && <div
            className={joinTrim([styles.chatMessage_content_operate, position === 'right' ? styles.operateRight : ''])}
          >
            <Dropdown
              placement="topRight"
              arrow={{
                pointAtCenter: true
              }}
              destroyPopupOnHide
              trigger={['click', 'hover']}
              menu={{
                items: [...screenDropdownItems(status, position)],
                onClick: ({ key }) => {
                  if (key === 'delete') {
                    onDelChatMessage?.()
                  }
                  if (key === 'refurbish') {
                    onRefurbishChatMessage?.()
                  }
                  if (key === 'copyout' && displayText) {
                    onCopyOut(displayText)
                  }
                }
              }}
            >
              <button type="button" aria-label="消息操作" className={styles.chatMessage_content_operate_icon}>
                <MoreOutlined />
              </button>
            </Dropdown>
          </div>}
      </div>
      {chatAvatar({
        style: { marginLeft: 8 },
        isShow: position === 'right',
        icon: avatarIcon
      })}
    </div>
  )
}

export default memo(ChatMessage)
