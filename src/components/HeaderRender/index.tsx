import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { notification } from 'antd'
import { HeaderViewProps } from '@ant-design/pro-layout/es/components/Header'
import styles from './index.module.less'
import {
  AppstoreOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  PayCircleOutlined,
  UserOutlined
} from '@ant-design/icons'
import { chatStore, userStore, billingNoticeStore } from '@/store'
import { Button, Dropdown } from 'antd'
import MenuList from '../MenuList'
import ThemeToggle from '../ThemeToggle'
import Brand from '../Brand'
import { useNavigate } from 'react-router-dom'
import { isAdmin } from '@/utils/isAdmin'

function HeaderRender(props: HeaderViewProps, defaultDom: React.ReactNode) {
  const navigate = useNavigate()

  const token = userStore((state) => state.token)
  const user_info = userStore((state) => state.user_info)
  const logout = userStore((state) => state.logout)
  const setLoginModal = userStore((state) => state.setLoginModal)
  const clearChats = chatStore((state) => state.clearChats)
  const changPage = chatStore((state) => state.changPage)
  const notice = billingNoticeStore((state) => state.notice)
  const hide = billingNoticeStore((state) => state.hide)

  // 滚动状态：滚过 12px 后顶栏收窄成悬浮胶囊，回到顶部再展开（纯视觉，不影响布局高度）
  const [scrolled, setScrolled] = useState(() => (window.scrollY || document.documentElement.scrollTop || 0) > 12)
  const progressRef = useRef<HTMLDivElement | null>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!inner) return

    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        inner.dataset.ready = 'true'
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = window.requestAnimationFrame(() => {
        raf = 0
        const top = window.scrollY || document.documentElement.scrollTop || 0
        setScrolled(top > 12)
        const max = document.documentElement.scrollHeight - window.innerHeight
        const ratio = max > 0 ? Math.min(1, top / max) : 0
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${ratio})`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => hide(), 4200)
    return () => window.clearTimeout(timer)
  }, [notice, hide])

  /**
   * 收缩目标宽度测量（2026-11-20 站长）
   * ------------------------------------------------------------
   * 站长：「导航栏滚动后整个从两边向里面缩，缩到正好容下导航栏内的信息，
   * 左右那个白框也要一起缩。」（之前的「只留当前页胶囊」方案被否了。）
   *
   * fit-content 这类关键字不能做过渡动画，所以这里用 JS 量出
   * 商标 + 菜单 + 右侧按钮的实际总宽度，写进 CSS 变量 --nav-compact；
   * 滚动后 .header__inner 的 max-width 从满宽过渡到它，白框自然从两边向里缩。
   * 菜单项数量（登录/访客）和滚动态字号都影响宽度，所以在这些时机重量。
   */
  useLayoutEffect(() => {
    if (props.isMobile) return
    const inner = innerRef.current
    if (!inner) return

    const measure = () => {
      const kids = Array.from(inner.children) as HTMLElement[]
      if (!kids.length) return
      const GAP = 4 // .header__inner 的 flex gap
      const ACTIVES_MARGIN = 16 // 右侧按钮区的 margin-left
      const PADDING_X = 28 // 收缩态 padding 0 14px
      /* 用 scrollWidth 而不是 offsetWidth：收缩动画进行中菜单会被挤压，
         offsetWidth 会越量越窄（2026-11-20 实测把「使用记录」「公告留言」挤没了），
         scrollWidth 始终是内容真实宽度，量几次都一样 */
      const content = kids.reduce((sum, el) => sum + Math.max(el.offsetWidth, el.scrollWidth), 0)
      const total = Math.ceil(content + GAP * (kids.length - 1) + ACTIVES_MARGIN + PADDING_X + 4)
      inner.style.setProperty('--nav-compact', `${total}px`)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(inner)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [props.isMobile, token, scrolled])

  const formatMoney = (value: number) => {
    if (value >= 1) return `¥${value.toFixed(2)}`
    if (value >= 0.01) return `¥${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`
    if (value === 0) return '¥0'
    return `¥${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
  }

  return (
    <div className={`${styles.header} ${scrolled ? styles.scrolled : ''} ${scrolled ? 'site-header-scrolled' : ''}`}>
      <div ref={progressRef} className={styles.progress} aria-hidden />
      {notice
        ? createPortal(
            <div className={styles.billingToast} role="status">
              <span>输入 {notice.input_tokens} tokens</span>
              <span>输出 {notice.output_tokens} tokens</span>
              <span>计费 {formatMoney(notice.cost)}</span>
              <span>余额 {formatMoney(notice.balance)}</span>
            </div>,
            document.body
          )
        : null}
      <div ref={innerRef} className={styles.header__inner}>
      {props.isMobile && props.hasSiderMenu && (
        <MenuUnfoldOutlined
          className={styles.header__menuIcon}
          onClick={() => props.onCollapse?.(!props.collapsed)}
        />
      )}
      <div className={styles.header__brand}>
        <Brand
          title={props.title as string}
          logo={typeof props.logo === 'string' ? props.logo : ''}
          compact={Boolean(props.isMobile)}
        />
      </div>
      {!props.isMobile && <MenuList />}
      <div className={styles.header__actives}>
        <ThemeToggle />
        {token ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Dropdown
              arrow
              placement="bottomRight"
              trigger={['click']}
              menu={{
                items: [
                  ...(isAdmin(user_info) ? [{ key: 'admin', label: '后台管理', onClick: () => navigate('/admin') }] : []),
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: '个人资料',
                    onClick: () => {
                      navigate('/profile')
                    }
                  },
                  {
                    key: 'wodeyue',
                    icon: <PayCircleOutlined />,
                    label: '我的钱包',
                    onClick: () => {
                      navigate('/price?tab=wallet')
                    }
                  },
                  {
                    /**
                     * 开票中心（2026-10-25 站长追加要求）
                     * ------------------------------------------------------------
                     * 站长原话：「导航里开票中心可以不需要了，因为在我的钱包这个页面
                     * 横幅上它是有开票中心的……把那个开票中心挪到那边
                     * （右上角用户头像下拉），让它不要在导航栏占位置。」
                     *
                     * 所以：顶栏不再有「开票中心」这一格，页面和 /invoice 路由都保留，
                     * 入口挪到这里。放「我的钱包」之后、「退出登录」之前 ——
                     * 开票是花完钱之后的动作，跟钱包挨着，离「退出」最远，不易误点。
                     */
                    key: 'invoice',
                    icon: <FileTextOutlined />,
                    label: '开票中心',
                    onClick: () => {
                      navigate('/invoice')
                    }
                  },
                  {
                    key: 'tuichudenglu',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: () => {
                      logout();
                      clearChats();
                      navigate('/login');
                      changPage(1);
                    }
                  }
                ]
              }}
            >
              <button type="button" className={styles.header__nameLogo} aria-label="打开用户菜单">
                {user_info?.data?.bodyMessage?.userName?.slice(0, 1) || '我'}
              </button>
            </Dropdown>
          </div>
        ) : (
          <Button
            type="primary"
            onClick={() => {
              setLoginModal(true)
            }}
          >
            登录 / 注册
          </Button>
        )}
        {props.isMobile && (
          <Dropdown
            arrow
            placement="bottomRight"
            destroyPopupOnHide
            trigger={['click']}
            /* 手机弹层必须限制宽度：默认会按内容撑开（实测 500px > 390px 屏幕），
               向右对齐后左边被挤到屏幕外，菜单名和图标全部看不见。
               这里把弹层最大宽度锁在视口内，内部列表宽 100%。 */
            overlayStyle={{ maxWidth: 'calc(100vw - 16px)' }}
            /* 这个类名给下方 CSS 用：窄屏把弹层钉在视口右侧，
               否则 antd 用压缩前的宽度算偏移，弹层会跑到屏幕外。 */
            overlayClassName="mobileMenuDropdown"
            dropdownRender={() => {
              return <MenuList mode="inline" />
            }}
          >
            <Button type="text" className={styles.header__actives_menu} title="打开菜单" aria-label="打开菜单">
              <AppstoreOutlined />
              <span>菜单</span>
            </Button>
          </Dropdown>
        )}
      </div>
      </div>
    </div>
  )
}

export default HeaderRender
