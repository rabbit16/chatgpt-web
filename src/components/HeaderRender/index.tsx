import React, { useEffect, useMemo, useState } from 'react'
import { HeaderViewProps } from '@ant-design/pro-layout/es/components/Header'
import styles from './index.module.less'
import {
  AppstoreOutlined,
  CloudSyncOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  PayCircleOutlined,
  ReconciliationOutlined,
  SyncOutlined,
  UserOutlined,
  WalletOutlined
} from '@ant-design/icons'
import { chatStore, userStore } from '@/store'
import { Avatar, Button, Dropdown } from 'antd'
import { getEmailPre } from '@/utils'
import MenuList from '../MenuList'
import { useNavigate } from 'react-router-dom'
import { fetchUserInfo } from '@/store/user/async'

function HeaderRender(props: HeaderViewProps, defaultDom: React.ReactNode) {
  const navigate = useNavigate()

  const { token, user_info, logout, setLoginModal } = userStore()
  const { clearChats } = chatStore()

  const renderLogo = useMemo(() => {
    if (typeof props.logo === 'string') return <img src={props.logo} />
    return <>{props.logo}</>
  }, [props.logo])

  return (
    <div className={styles.header}>
      {props.isMobile && props.hasSiderMenu && (
        <MenuUnfoldOutlined
          className={styles.header__menuIcon}
          onClick={() => props.onCollapse?.(!props.collapsed)}
        />
      )}
      <div className={styles.header__logo}>

        {!props.isMobile && <h1>{props.title}</h1>}
      </div>
      {!props.isMobile && <MenuList />}
      <div className={styles.header__actives}>
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
                  // {
                  //   key: 'yonghuzhongxin',
                  //   icon: <UserOutlined />,
                  //   label: '用户中心',
                  //   onClick: () => {
                  //     navigate('/user')
                  //   }
                  // },
                  {
                    key: 'wodeyue',
                    icon: <PayCircleOutlined />,
                    label: '我的钱包',
                    onClick: () => {
                      navigate('/shop')
                    }
                  },
                  // {
                  //   key: 'xiaofeijilu',
                  //   icon: <ReconciliationOutlined />,
                  //   label: '消费记录',
                  //   onClick: () => {
                  //     navigate('/shop')
                  //   }
                  // },
                  {
                    key: 'tuichudenglu',
                    icon: <LogoutOutlined />,
                    label: '退出登录',
                    onClick: () => {
                      window.localStorage.removeItem('user_storage')
                      // localStorage.clear();

                      logout()
                      clearChats()
                      navigate('/login')
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
  )
}

export default HeaderRender
