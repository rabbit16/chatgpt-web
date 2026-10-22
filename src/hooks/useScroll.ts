import type { RefObject } from 'react'
import { useCallback, useRef } from 'react'

export function useScroll(scrollRef: RefObject<HTMLDivElement | null>) {
  const pinnedToBottom = useRef(true)

  const trackScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    pinnedToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 100
  }, [scrollRef])

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    pinnedToBottom.current = true
  }, [scrollRef])

  const scrollToBottomIfAtBottom = useCallback(() => {
    if (pinnedToBottom.current) scrollToBottom()
  }, [scrollToBottom])

  return { scrollToBottom, scrollToBottomIfAtBottom, trackScroll }
}
