import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { notification } from 'antd'
import { HeaderViewProps } from '@ant-design/pro-layout/es/components/Header'
import styles from './index.module.less'
import {
  AppstoreOutlined,
  ControlOutlined,
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
  const [scrolled, setScrolled] = useState(false)
  const progressRef = useRef<HTMLDivElement | null>(null)

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

  const formatMoney = (value: number) => {
    if (value >= 1) return `¥${value.toFixed(2)}`
    if (value >= 0.01) return `¥${value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`
    if (value === 0) return '¥0'
    return `¥${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
  }

  return (
    <div className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
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
      <div className={styles.header__inner}>
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
            {isAdmin(user_info) ? (
              <Button type="link" onClick={() => navigate('/admin')}>
                后台
              </Button>
            ) : null}
            <Dropdown
              arrow
              placement="bottomRight"
              trigger={['click']}
              menu={{
                items: [
                  ...(isAdmin(user_info)
                    ? [
                        {
                          key: 'admin',
                          icon: <ControlOutlined />,
                          label: '后台管理',
                          onClick: () => {
                            navigate('/admin')
                          }
                        }
                      ]
                    : []),
                  {
                    key: 'profile',
                    icon: <UserOutlined />,
                    label: '个人资料',
                    onClick: () => {
                      navigate('/profile')
                    }
                  },
                  {
                    key: 'invoice',
                    icon: <FileTextOutlined />,
                    label: '开发票',
                    onClick: () => {
                      navigate('/invoice')
                    }
                  },
                  {
                    key: 'wodeyue',
                    icon: <PayCircleOutlined />,
                    label: '我的钱包',
                    onClick: () => {
                      navigate('/shop')
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className={styles.header__nameLogo}>
                  {user_info?.data?.bodyMessage?.userName.slice(0,1)
}
                </div>
              </div>
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
            dropdownRender={() => {
              return <MenuList mode="inline" />
            }}
          >
            <div className={styles.header__actives_menu}>
              <AppstoreOutlined />
            </div>
          </Dropdown>
        )}
      </div>
      </div>
    </div>
  )
}

export default HeaderRender
