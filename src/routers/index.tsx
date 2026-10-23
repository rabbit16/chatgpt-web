import React from 'react'
import type { RouteObject } from 'react-router-dom'

type ConfigureType = {
  verifToken?: boolean
  public?: boolean
  title?: string
  role: Array<'user' | 'administrator' | string>
}

export interface RouteOptions extends Omit<Omit<RouteObject, 'children'>, 'index'> {
  index?: boolean
  children?: RouteOptions[]
  configure?: ConfigureType
}

const ChatPage = React.lazy(() => import('@/pages/chat'))
const ShopPage = React.lazy(() => import('@/pages/shop'))
const UsagePage = React.lazy(() => import('@/pages/usage'))
const TasksPage = React.lazy(() => import('@/pages/tasks'))
const PricePage = React.lazy(() => import('@/pages/price'))
const DrawPage = React.lazy(() => import('@/pages/draw'))
const AnnouncementPage = React.lazy(() => import('@/pages/announcement'))
const FeedbackPage = React.lazy(() => import('@/pages/feedback'))
const AgentPage = React.lazy(() => import('@/pages/agent'))
const SoftwarePage = React.lazy(() => import('@/pages/software'))
const ProfilePage = React.lazy(() => import('@/pages/profile'))
const LoginPage = React.lazy(() => import('@/pages/login'))
const ResultPage = React.lazy(() => import('@/pages/result'))
const Page404 = React.lazy(() => import('@/pages/404'))
const AdminPage = React.lazy(() => import('@/pages/admin'))

export const webRouter: RouteOptions[] = [
  {
    id: 'ChatPage',
    path: '/',
    element: <ChatPage />,
    children: [],
    configure: {
      verifToken: false,
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ShopPage',
    path: '/shop',
    element: <ShopPage />,
    children: [],
    configure: {
      verifToken: true,
      role: ['user', 'administrator']
    }
  },
  {
    id: 'TasksPage',
    path: '/tasks',
    element: <TasksPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '我的任务',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'UsagePage',
    path: '/usage',
    element: <UsagePage />,
    children: [],
    configure: {
      verifToken: true,
      title: '使用记录',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'PricePage',
    path: '/price',
    element: <PricePage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '模型价格',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'DrawPage',
    path: '/draw',
    element: <DrawPage />,
    children: [],
    configure: {
      verifToken: true,
      title: 'AI 绘图',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'AnnouncementPage',
    path: '/announcement',
    element: <AnnouncementPage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '公告',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'FeedbackPage',
    path: '/feedback',
    element: <FeedbackPage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '留言反馈',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'AgentPage',
    path: '/agent',
    element: <AgentPage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: 'Agent 接入',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ProfilePage',
    path: '/profile',
    element: <ProfilePage />,
    children: [],
    configure: {
      verifToken: true,
      title: '个人资料',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'SoftwarePage',
    path: '/software',
    element: <SoftwarePage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '软件下载',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'LoginPage',
    path: '/login',
    element: <LoginPage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ResultPage',
    path: '/result',
    element: <ResultPage />,
    children: [],
    configure: {
      verifToken: false,
      role: ['user', 'administrator']
    }
  },
  {
    id: 'AdminPage',
    path: '/admin',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '后台管理',
      role: ['administrator']
    }
  },
  {
    id: 'AdminUsersPage',
    path: '/admin/users',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '用户管理',
      role: ['administrator']
    }
  },
  {
    id: 'AdminAnnouncementPage',
    path: '/admin/announcement',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '公告管理',
      role: ['administrator']
    }
  },
  {
    id: 'AdminFeedbackPage',
    path: '/admin/feedback',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '留言管理',
      role: ['administrator']
    }
  },
  {
    id: 'AdminOrdersPage',
    path: '/admin/orders',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '订单管理',
      role: ['administrator']
    }
  },
  {
    id: 'AdminTasksPage',
    path: '/admin/tasks',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '代理任务',
      role: ['administrator']
    }
  },
  {
    id: 'AdminUsagePage',
    path: '/admin/usage',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '请求用量',
      role: ['administrator']
    }
  },
  {
    id: 'AdminVendorsPage',
    path: '/admin/vendors',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '供应商管理',
      role: ['administrator']
    }
  },
  {
    id: 'AdminUserPricePage',
    path: '/admin/userprice',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '用户专属价',
      role: ['administrator']
    }
  },
  {
    id: 'AdminPromptPage',
    path: '/admin/prompt',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: 'Prompt 注入',
      role: ['administrator']
    }
  },
  {
    id: 'AdminSoftwarePage',
    path: '/admin/software',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '软件下载',
      role: ['administrator']
    }
  },
  {
    id: 'AdminPricingPage',
    path: '/admin/pricing',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '费率设置',
      role: ['administrator']
    }
  },
  {
    id: 'AdminPayChannelPage',
    path: '/admin/paychannel',
    element: <AdminPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '支付方式',
      role: ['administrator']
    }
  },
  {
    id: 'Page404',
    path: '/404',
    element: <Page404 />,
    children: [],
    configure: {
      verifToken: false,
      role: ['user', 'administrator']
    }
  },
  {
    id: 'Page404Fallback',
    path: '*',
    element: <Page404 />,
    children: [],
    configure: {
      verifToken: false,
      role: ['user', 'administrator']
    }
  }
]

export const adminRouter: RouteOptions[] = []

export function searchRouteDetail(path: string, routes: RouteOptions[]): RouteOptions | null {
  let detail = null
  const forRouter = (path: string, routes: RouteOptions[]) => {
    for (const item of routes) {
      if (item.path === path) {
        detail = item
      }
      if (item.children && item.children.length > 0) {
        forRouter(path, item.children)
      }
    }
  }

  forRouter(path, routes)

  return detail
}

export default {}
