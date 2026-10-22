import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * 主题（浅色 / 深色 / 跟随系统）
 * ------------------------------------------------------------
 * 用户选的不是「现在用哪个颜色」，而是「听谁的」：
 *   light / dark = 用户说了算；system = 听操作系统的。
 * 选择存 localStorage（键 theme_storage），刷新后保持；
 * 真正生效的颜色写在 <html data-theme="..."> 上，CSS 变量按它切换。
 */
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const THEME_LABEL: Record<ThemeMode, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统'
}

export const themeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode })
    }),
    {
      name: 'theme_storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

/** 系统当前是不是深色；监听变化，用户改了系统外观时跟着变 */
export function useSystemDark() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    if (!window.matchMedia) return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return dark
}

/** 最终生效的主题：mode 不是 system 时以用户选择为准 */
export function useResolvedTheme(): ResolvedTheme {
  const mode = themeStore((state) => state.mode)
  const systemDark = useSystemDark()
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}
