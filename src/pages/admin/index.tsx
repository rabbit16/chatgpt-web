import { DefaultFooter, ProLayout } from '@ant-design/pro-components'
import styles from './index.module.less'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Dropdown, Spin } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import React, { useEffect } from 'react'
import menuList from '@/routers/menu_list'
import { chatStore, userStore } from '@/store'
import { isAdmin } from '@/utils/isAdmin'
import AdminOverview from './overview'
import AdminUsers from './users'
import AdminAnnouncement from './announcement'
import AdminFeedback from './feedback'
import AdminOrders from './orders'
import AdminInvoices from './invoices'
import AdminProjects from './projects'
import AdminUsage from './usage'
import AdminVendors from './vendors'
import AdminPrompt from './prompt'
import AdminPricing from './pricing'
import AdminSoftware from './software'
import AdminTasks from './tasks'
import AdminPayChannel from './paychannel'

function renderAdminContent(pathname: string) {
  if (pathname.startsWith('/admin/users')) return <AdminUsers />
  if (pathname.startsWith('/admin/paychannel')) return <AdminPayChannel />
  if (pathname.startsWith('/admin/announcement')) return <AdminAnnouncement />
  if (pathname.startsWith('/admin/feedback')) return <AdminFeedback />
  if (pathname.startsWith('/admin/orders')) return <AdminOrders />
  if (pathname.startsWith('/admin/invoices')) return <AdminInvoices />
  if (pathname.startsWith('/admin/projects')) return <AdminProjects />
  if (pathname.startsWith('/admin/usage')) return <AdminUsage />
  if (pathname.startsWith('/admin/tasks')) return <AdminTasks />
  if (pathname.startsWith('/admin/vendors')) return <AdminVendors />
  if (pathname.startsWith('/admin/prompt')) return <AdminPrompt />
  if (pathname.startsWith('/admin/pricing')) return <AdminPricing />
  if (pathname.startsWith('/admin/software')) return <AdminSoftware />
  return <AdminOverview />
}

function AdminPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { token, user_info, logout } = userStore()
  const { clearChats } = chatStore()
  const pathname = location.pathname || '/admin'

  useEffect(() => {
    if (!token || !isAdmin(user_info)) {
      navigate('/')
    }
  }, [token, user_info, navigate])

  if (!token || !isAdmin(user_info)) {
    return null
  }

  return (
    <div className={styles.admin}>
      <ProLayout
        title="后台管理"
        logo={import.meta.env.VITE_APP_LOGO}
        layout="mix"
        splitMenus={false}
        contentWidth="Fluid"
        fixedHeader
        fixSiderbar
        location={{
          pathname
        }}
        contentStyle={{
          minHeight: 'calc(100vh - 56px)',
          overflow: 'auto'
        }}
        theme="light"
        siderMenuType="group"
        menu={{
          locale: false,
          collapsedShowGroupTitle: false
        }}
        siderWidth={240}
        menuExtraRender={() => (
          <div style={{ padding: '8px 12px', color: '#667085', fontSize: 12 }}>
            {user_info?.data?.bodyMessage?.userName || '管理员'}
          </div>
        )}
        route={menuList.admin}
        menuItemRender={(item: any, dom: React.ReactNode) => {
          return (
            <Link key={item.path} to={`${item.path}`}>
              {dom}
            </Link>
          )
        }}
        avatarProps={{
          src: 'https://u1.dl0.cn/icon/1682426702646avatarf3db669b024fad66-1930929abe2847093.png',
          size: 'small',
          title: '管理员',
          render: (_props: any, dom: React.ReactNode) => {
            return (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'home',
                      label: '返回前台',
                      onClick: () => navigate('/')
                    },
                    {
                      key: 'logout',
                      icon: <LogoutOutlined />,
                      label: '退出登录',
                      onClick: () => {
                        logout()
                        clearChats()
                        window.localStorage.clear()
                        navigate('/login')
                      }
                    }
                  ]
                }}
              >
                {dom}
              </Dropdown>
            )
          }
        }}
        menuFooterRender={(props: any) => {
          if (props?.collapsed) return undefined
          return (
            <div style={{ textAlign: 'center', paddingBlockStart: 12, color: '#98a2b3' }}>
              仅管理员可见
            </div>
          )
        }}
        menuProps={{
          selectedKeys: [pathname],
          theme: 'light'
        }}
        breadcrumbRender={() => []}
        footerRender={() => <DefaultFooter copyright="GPT Admin" />}
      >
        <div key={pathname} className={styles.content}>
          <React.Suspense
            fallback={
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Spin />
              </div>
            }
          >
            {renderAdminContent(pathname)}
          </React.Suspense>
        </div>
      </ProLayout>
    </div>
  )
}

export default AdminPage
