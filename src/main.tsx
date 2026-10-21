import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './pages/App'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import AuthRouter from './routers/auth_router'
import Global from './components/Global'
import OpenAiLogo from './components/OpenAiLogo'

// 顺序很重要：设计 token 先定义，后面的样式与组件才能引用
import '@/styles/tokens.less'
import '@/styles/global.less'
import '@/styles/markdown.less'
import '@/styles/highlight.less'

import antdTheme from '@/styles/theme'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ConfigProvider theme={antdTheme} locale={zhCN}>
    <BrowserRouter>
      <AuthRouter>
        <Global>
          <React.Suspense
            fallback={
              <div
                style={{
                  width: '100vw',
                  height: '100vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <OpenAiLogo rotate width="3em" height="3em" />
              </div>
            }
          >
            <App />
          </React.Suspense>
        </Global>
      </AuthRouter>
    </BrowserRouter>
  </ConfigProvider>
)
