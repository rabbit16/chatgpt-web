import menuList from '@/routers/menu_list'
import styles from './index.module.less'
import { joinTrim } from '@/utils'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { Dropdown } from 'antd'
import { DownOutlined, EllipsisOutlined } from '@ant-design/icons'

type Props = {
  mode?: 'vertical' | 'horizontal' | 'inline'
}

type MenuItemData = (typeof menuList.web)[number]

/**
 * 导航菜单（T2 · IA-2）
 * ------------------------------------------------------------
 * horizontal：顶栏只出 5 项高频 + 「更多」下拉，解决 11 项挤一行；
 * inline/vertical：保持完整列表，给移动端抽屉用。
 * 当前页若在「更多」里，更多按钮本身高亮，用户不会"迷路"。
 */
function MenuList(props: Props) {
  const location = useLocation()
  const navigate = useNavigate()

  const pathname = useMemo(() => {
    return location.pathname
  }, [location])

  const { mode = 'horizontal' } = props

  const renderItem = (item: MenuItemData) => {
    const isExternal = /^(http:\/\/|https:\/\/)/.test(item.path)
    return (
      <Link key={item.path} to={item.path} target={isExternal ? '_blank' : '_self'}>
        <div
          className={joinTrim([styles.item, pathname === item.path ? styles.select_item : ''])}
        >
          <span className={styles.item_icon}>{item.icon}</span>
          <div className={styles.item_text}>
            <p className={styles.item_title}>{item.name}</p>
            {mode !== 'horizontal' && (
              <span className={styles.item_message}>{item.message}</span>
            )}
          </div>
        </div>
      </Link>
    )
  }

  if (mode !== 'horizontal') {
    return (
      <div className={joinTrim([styles.menuList, styles['menuList_' + mode]])}>
        {menuList.web.map(renderItem)}
      </div>
    )
  }

  const hasActiveInMore = menuList.more.some((item) => item.path === pathname)

  const moreItems = menuList.more.map((item) => ({
    key: item.path,
    icon: item.icon,
    label: item.name,
    onClick: () => navigate(item.path)
  }))

  return (
    <div className={joinTrim([styles.menuList, styles.menuList_horizontal])}>
      {menuList.primary.map(renderItem)}
      <Dropdown
        menu={{ items: moreItems, selectedKeys: [pathname] }}
        trigger={['hover', 'click']}
        placement="bottomRight"
      >
        <div
          className={joinTrim([styles.item, hasActiveInMore ? styles.select_item : ''])}
          aria-label="更多功能"
        >
          <span className={styles.item_icon}>
            <EllipsisOutlined />
          </span>
          <div className={styles.item_text}>
            <p className={styles.item_title}>
              更多
              <DownOutlined className={styles.item_caret} />
            </p>
          </div>
        </div>
      </Dropdown>
    </div>
  )
}

export default MenuList
