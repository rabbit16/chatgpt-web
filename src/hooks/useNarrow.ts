import { useEffect, useState } from 'react'

/**
 * 是否"窄屏"（默认 ≤768px）
 * ------------------------------------------------------------
 * 和 useMobile 的区别：useMobile 看 UA，只在真手机/平板上为 true；
 * 这个看**窗口宽度**，所以桌面浏览器把窗口拖窄、或 DevTools 切手机视图也会生效。
 *
 * 用途：表格列宽、固定列、scroll.x 这类"只看宽度"的响应式判断。
 * 首屏渲染时直接读 innerWidth，避免先按桌面渲染一帧再跳变。
 */
export function useNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= breakpoint
  })

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= breakpoint)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])

  return narrow
}

export default useNarrow
