import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import { BrowserRouter } from 'react-router-dom'
import AuthRouter from './routers/auth_router'
import Global from './components/Global'
import ThemeProvider from './components/ThemeProvider'
import AppLoading from './components/AppLoading'
import { userStore } from './store'
import { demoEnabled, demoRole } from './demo/runtime'

// 顺序很重要：设计 token 先定义，后面的样式与组件才能引用
import '@/styles/tokens.less'
import '@/styles/global.less'
import '@/styles/markdown.less'
import '@/styles/highlight.less'

const DemoControls = import.meta.env.DEV && import.meta.env.MODE === 'rabbitj-demo'
  ? React.lazy(() => import('./demo/Controls'))
  : null

async function start() {
  if (demoEnabled) {
    const { installDemoTransport, demoAccount } = await import('./demo/transport')
    installDemoTransport()
    const role = demoRole()
    if (role !== 'guest') {
      userStore.setState({ token: 'local-preview', user_info: demoAccount() as unknown as ReturnType<typeof userStore.getState>['user_info'], llm_api_key: 'sk-local-preview' })
    }
  }
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ThemeProvider>
    <BrowserRouter>
      <AuthRouter>
        <Global>
          {/* 首屏骨架：原来是全屏旋转 logo（弱网下就是一片白，用户以为站挂了）。
              换成带品牌 + 说明 + 三张占位卡的骨架，形状贴近真实页面。 */}
          <React.Suspense fallback={<AppLoading />}>
            <App />
            {demoEnabled && DemoControls && <DemoControls />}
          </React.Suspense>
        </Global>
      </AuthRouter>
    </BrowserRouter>
  </ThemeProvider>
)
}

void start()
