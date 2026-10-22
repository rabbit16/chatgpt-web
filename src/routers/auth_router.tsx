import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminRouter, searchRouteDetail, webRouter } from './index'
import { userStore } from '@/store'
import { isAdmin } from '@/utils/isAdmin'

type AuthRouterProps = {
  children?: React.ReactNode
}

function AuthRouter(props: AuthRouterProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const token = userStore((state) => state.token)
  const user_info = userStore((state) => state.user_info)
  const setLoginModal = userStore((state) => state.setLoginModal)
  const { pathname } = location
  const routerDetail = searchRouteDetail(pathname, [...webRouter, ...adminRouter])
  const title = routerDetail?.configure?.title
  useEffect(() => {
    if (title) {
      document.title = title
    }
    if(token && user_info && location.pathname.includes('/login')){
      navigate('/')
      return 
    }
    const userRole = isAdmin(user_info) ? 'administrator' : (user_info?.role || 'user')
    const isPublic = Boolean(routerDetail?.configure?.public) || pathname === '/login'
    if (!token && pathname !== '/login' && (routerDetail?.configure?.verifToken || !isPublic)) {
      setLoginModal(true)
    } else if (token && routerDetail?.configure?.role && !routerDetail.configure.role.includes(userRole)) {
      navigate('/404')
    }
  }, [pathname, routerDetail,token])

  return <>{props.children}</>
}

export default AuthRouter
