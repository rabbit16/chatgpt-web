import { useEffect } from 'react'
import { Navigate, matchPath, useLocation } from 'react-router-dom'
import { webRouter } from './index'
import { userStore } from '@/store'
import { isAdmin } from '@/utils/isAdmin'

type AuthRouterProps = {
  children?: React.ReactNode
}

function loginReturnTarget(search: string) {
  const next = new URLSearchParams(search).get('returnTo')
  if (!next || !next.startsWith('/') || /[\\\s]/.test(next)) return '/chat'
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin || /^\/login\/?$/i.test(url.pathname)) return '/chat'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/chat'
  }
}

function AuthRouter({ children }: AuthRouterProps) {
  const { pathname, search, hash } = useLocation()
  const token = userStore((state) => state.token)
  const user = userStore((state) => state.user_info)
  const setLoginModal = userStore((state) => state.setLoginModal)
  const route = webRouter.find((item) => item.path && matchPath(item.path, pathname))
  const { title, verifToken, public: isPublic, role } = route?.configure || {}
  const loginRequired = verifToken || (pathname === '/price' && new URLSearchParams(search).get('tab') === 'wallet')
  const userRole = isAdmin(user) ? 'administrator' : user?.role || 'user'
  const showLoginModal = !token && !loginRequired && !isPublic && route?.path === '/chat'

  useEffect(() => {
    document.title = title || 'rabbitJ'
  }, [title])

  useEffect(() => {
    setLoginModal(Boolean(showLoginModal))
  }, [pathname, showLoginModal, setLoginModal])

  if (token && pathname === '/login') return <Navigate to={loginReturnTarget(search)} replace />
  if (!token && loginRequired) return <Navigate to={`/login?returnTo=${encodeURIComponent(pathname + search + hash)}`} replace />
  if (token && role && !role.includes(userRole)) return <Navigate to="/404" replace state={{ forbidden: true }} />
  return <>{children}</>
}

export default AuthRouter
