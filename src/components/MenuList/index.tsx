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

  /**
   * 当前 URL 的 tab（价格页用它区分「模型价格 / 我的钱包」两个菜单项）
   * ------------------------------------------------------------
   * 语义与 price 页完全一致：viewTab = rawTab === 'wallet' ? 'wallet' : 'price'，
   * 也就是说**没有 tab 参数、或 tab 是 price/shop 等任何非 wallet 的值，都算「模型价格」**。
   *
   * 为什么必须这样：价格页点「模型价格」页签时 switchTab 会删掉 tab 参数
   * （URL 变成裸 /price）。如果这里只认 tab=price，
   * 用户从页内页签切回价格时顶部菜单就会不高亮——看着像导航坏了。
   */
  const currentTab = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('tab')
    return raw === 'wallet' ? 'wallet' : 'price'
  }, [location.search])

  const items: MenuItemData[] = token ? menuList.userNav : menuList.guestNav

  /**
   * 是否高亮某一个菜单项
   * ------------------------------------------------------------
   * 普通菜单项（没有 matchTab / matchAlso）：行为与改动前**完全一致**，只比 pathname。
   * 带 matchTab 的菜单项（模型价格 / 我的钱包）：pathname 命中且 tab 也命中才算高亮，
   * 否则共用 /price 的两项会同时亮（2026-10-25 拆导航时踩到的坑）。
   * 带 matchAlso 的菜单项（Agent 接入）：除了自己的 /agent，列出的其他路径也算选中。
   * 为什么需要：「接入教程」已并入 /agent 做成页签，但 /guide 作为旧链接仍然可用；
   * 用户在 /guide 时若导航一项都不亮，会以为「我不在 Agent 接入里」。
   */
  const isActive = (item: MenuItemData) => {
    const meta = item as { matchTab?: string; matchAlso?: string[] }
    // 额外路径：教程等从属页面，也算这一项被选中
    if (meta.matchAlso?.includes(pathname)) return true
    if (!meta.matchTab) return pathname === item.path
    return pathname === item.path.split('?')[0] && currentTab === meta.matchTab
  }

  const renderItem = (item: MenuItemData) => {
    const isExternal = /^(http:\/\/|https:\/\/)/.test(item.path)
    const active = isActive(item)

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
