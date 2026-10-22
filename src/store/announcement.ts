import { create } from 'zustand'
import { getLatestAnnouncement, type AnnouncementItem } from '@/request/api'

/**
 * 公告「有没有新的」
 * ------------------------------------------------------------
 * 判断标准很简单：最新公告的 id ≠ 本机记住的「已读 id」→ 有新公告。
 * 已读 id 存在 localStorage（键 anygpt_announcement_seen），
 * 和公告弹窗共用同一把钥匙，所以「弹窗关掉」「进过公告页」都算读过。
 */
export const ANNOUNCEMENT_SEEN_KEY = 'anygpt_announcement_seen'

function readSeenId() {
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_SEEN_KEY) || ''
  } catch {
    return ''
  }
}

function writeSeenId(id: string | number) {
  try {
    window.localStorage.setItem(ANNOUNCEMENT_SEEN_KEY, String(id))
  } catch {
    // 隐私模式写不进去，最多多提示一次，不影响功能
  }
}

function pickLatest(res: any): AnnouncementItem | null {
  const payload = res?.data && typeof res.data === 'object' ? res.data : res
  const item = payload?.item || payload?.data?.item
  if (!item?.id) return null
  return item as AnnouncementItem
}

interface AnnouncementState {
  latest: AnnouncementItem | null
  seenId: string
  loading: boolean
  loaded: boolean
  load: () => Promise<void>
  markSeen: () => void
}

export const announcementStore = create<AnnouncementState>((set, get) => ({
  latest: null,
  seenId: readSeenId(),
  loading: false,
  loaded: false,
  load: async () => {
    if (get().loading || get().loaded) return
    set({ loading: true })
    try {
      const res = await getLatestAnnouncement()
      const latest = pickLatest(res)
      if (latest) set({ latest })
    } catch {
      // 公告接口失败不影响主流程
    } finally {
      set({ loading: false, loaded: true })
    }
  },
  markSeen: () => {
    const id = get().latest?.id
    if (!id) return
    writeSeenId(id)
    set({ seenId: String(id) })
  }
}))

/** 导航上的小红点用这个：有新公告才亮 */
export function useAnnouncementUnread() {
  return announcementStore((state) => Boolean(state.latest) && String(state.latest?.id) !== state.seenId)
}
