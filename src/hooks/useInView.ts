import { useEffect, useRef, useState } from 'react'

/**
 * 元素进入视口一次性回调（用于入场动效、数字滚动）
 * - 只触发一次，避免上下滚动时反复闪烁
 * - 优先用 IntersectionObserver；不支持时直接视为可见
 */
export function useInView<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true)
            observer.disconnect()
          }
        })
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15, ...options }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [options])

  return { ref, inView }
}

/** 系统是否要求“减少动态效果”（无障碍：动效敏感用户直接看静止画面） */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
