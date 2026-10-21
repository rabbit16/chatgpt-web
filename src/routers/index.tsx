import React from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'

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

const HomePage = React.lazy(() => import('@/pages/home'))
const ProjectsPage = React.lazy(() => import('@/pages/projects'))
const ProjectDetailPage = React.lazy(() => import('@/pages/projects/detail'))
const ChatPage = React.lazy(() => import('@/pages/chat'))
const RecordsPage = React.lazy(() => import('@/pages/records'))
const PricePage = React.lazy(() => import('@/pages/price'))
const GuidePage = React.lazy(() => import('@/pages/guide'))
const DrawPage = React.lazy(() => import('@/pages/draw'))
const NoticePage = React.lazy(() => import('@/pages/notice'))
const ProfilePage = React.lazy(() => import('@/pages/profile'))
const LoginPage = React.lazy(() => import('@/pages/login'))
const ResultPage = React.lazy(() => import('@/pages/result'))
const Page404 = React.lazy(() => import('@/pages/404'))
const AdminPage = React.lazy(() => import('@/pages/admin'))

export const webRouter: RouteOptions[] = [
  {
    id: 'HomePage',
    path: '/',
    element: <HomePage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '一个地址接通主流大模型',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ProjectsPage',
    path: '/projects',
    element: <ProjectsPage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '开源项目',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ProjectDetailPage',
    path: '/projects/:id',
    element: <ProjectDetailPage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '项目详情',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ChatPage',
    path: '/chat',
    element: <ChatPage />,
    children: [],
    configure: {
      verifToken: false,
      title: '模型体验',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'ShopRedirect',
    path: '/shop',
    element: <Navigate to="/price?tab=shop" replace />,
    children: [],
    configure: {
      verifToken: true,
      title: '余额与充值',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'TasksRedirect',
    path: '/tasks',
    element: <Navigate to="/usage?tab=tasks" replace />,
    children: [],
    configure: {
      verifToken: true,
      title: '用量与任务',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'RecordsPage',
    path: '/usage',
    element: <RecordsPage />,
    children: [],
    configure: {
      verifToken: true,
      title: '用量与任务',
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
    id: 'GuidePage',
    path: '/guide',
    element: <GuidePage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '接入指南',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'DocsRedirect',
    path: '/docs',
    element: <Navigate to="/guide" replace />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '接入指南',
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
    id: 'NoticePage',
    path: '/notice',
    element: <NoticePage />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '公告与留言',
      role: ['user', 'administrator']
    }
  },
  // 老地址保留跳转，避免站内旧链接与收藏失效
  {
    id: 'AnnouncementRedirect',
    path: '/announcement',
    element: <Navigate to="/notice" replace />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '公告与留言',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'FeedbackRedirect',
    path: '/feedback',
    element: <Navigate to="/notice?tab=feedback" replace />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '公告与留言',
      role: ['user', 'administrator']
    }
  },
  {
    id: 'AgentRedirect',
    path: '/agent',
    element: <Navigate to="/guide?tab=client" replace />,
    children: [],
    configure: {
      verifToken: false,
      public: true,
      title: '接入指南',
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
    id: 'SoftwareRedirect',
    path: '/software',
    element: <Navigate to="/guide?tab=download" replace />,
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
