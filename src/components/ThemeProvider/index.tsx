import { useEffect } from 'react'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useResolvedTheme } from '@/store/theme'
import { getAntdTheme } from '@/styles/theme'

/**
 * 主题外壳
 * ------------------------------------------------------------
 * 只做三件事：
 * 1. 把最终主题写到 <html data-theme="dark|light">，CSS 变量跟着切换；
 * 2. 给 antd 换一整套主题（深色用 darkAlgorithm），组件库跟着变；
 * 3. 同步浏览器地址栏颜色（手机上进网页时地址栏颜色一致，不刺眼）。
 */
function ThemeProvider({ children }: { children: React.ReactElement }) {
  const resolved = useResolvedTheme()

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolved)
    // 代码高亮（highlight.less / markdown.less）按 html.dark 切换，这里同步一下
    root.classList.toggle('dark', resolved === 'dark')
    root.classList.toggle('light', resolved === 'light')
    root.style.colorScheme = resolved

    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'theme-color'
      document.head.appendChild(meta)
    }
    meta.content = resolved === 'dark' ? '#18181b' : '#f7f9fd'
  }, [resolved])

  return (
    <ConfigProvider theme={getAntdTheme(resolved === 'dark')} locale={zhCN}>
      {children}
    </ConfigProvider>
  )
}

export default ThemeProvider
