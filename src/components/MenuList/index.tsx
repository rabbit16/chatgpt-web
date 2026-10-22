import menuList from '@/routers/menu_list'
import styles from './index.module.less'
import { joinTrim } from '@/utils'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo } from 'react'
import { userStore } from '@/store'
import { announcementStore, useAnnouncementUnread } from '@/store/announcement'

type Props = {
  mode?: 'vertical' | 'horizontal' | 'inline'
}

type MenuItemData = (typeof menuList.guestNav)[number]

/**
 * 导航菜单（扁平化 + 靠右）
 * ------------------------------------------------------------
 * 没有「更多」下拉了：访客 7 项、登录后 8 项全部平铺，右对齐到登录按钮旁。
 * 当前页高亮为药丸底（浅蓝底 + 品牌字色），移动端沿用竖向列表。
 */
function MenuList(props: Props) {
  const location = useLocation()
  const { mode = 'horizontal' } = props
  const token = userStore((state) => state.token)
  const loadAnnouncement = announcementStore((state) => state.load)
  const hasNewAnnouncement = useAnnouncementUnread()

  // 导航第一次出现时问一次「有没有新公告」，失败就算了，不打扰
  useEffect(() => {
    void loadAnnouncement()
  }, [loadAnnouncement])

  const pathname = useMemo(() => location.pathname, [location])

  const items: MenuItemData[] = token ? menuList.userNav : menuList.guestNav

  const renderItem = (item: MenuItemData) => {
    const isExternal = /^(http:\/\/|https:\/\/)/.test(item.path)
    const active = pathname === item.path

    return (
      <Link key={item.path} to={item.path} target={isExternal ? '_blank' : '_self'}>
        <div className={joinTrim([styles.item, active ? styles.select_item : ''])}>
          <span className={styles.item_icon}>
            {item.icon}
            {item.path === '/notice' && hasNewAnnouncement ? (
              <i className={styles.item_dot} aria-label="有新公告" />
            ) : null}
          </span>
          <div className={styles.item_text}>
            <p className={styles.item_title}>{item.name}</p>
            {mode !== 'horizontal' && <span className={styles.item_message}>{item.message}</span>}
          </div>
        </div>
      </Link>
    )
  }

  if (mode !== 'horizontal') {
    return (
      <div className={joinTrim([styles.menuList, styles['menuList_' + mode]])}>
        {items.map(renderItem)}
      </div>
    )
  }

  return (
    <nav className={joinTrim([styles.menuList, styles.menuList_horizontal])} aria-label="主导航">
      {items.map(renderItem)}
    </nav>
  )
}

export default MenuList
