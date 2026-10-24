import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import { BrowserRouter } from 'react-router-dom'
import AuthRouter from './routers/auth_router'
import Global from './components/Global'
import ThemeProvider from './components/ThemeProvider'
import AppLoading from './components/AppLoading'

// 顺序很重要：设计 token 先定义，后面的样式与组件才能引用
import '@/styles/tokens.less'
import '@/styles/global.less'
import '@/styles/markdown.less'
import '@/styles/highlight.less'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ThemeProvider>
    <BrowserRouter>
      <AuthRouter>
        <Global>
          {/* 首屏骨架：原来是全屏旋转 logo（弱网下就是一片白，用户以为站挂了）。
              换成带品牌 + 说明 + 三张占位卡的骨架，形状贴近真实页面。 */}
          <React.Suspense fallback={<AppLoading />}>
            <App />
          </React.Suspense>
        </Global>
      </AuthRouter>
    </BrowserRouter>
  </ThemeProvider>
)
