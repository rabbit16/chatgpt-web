import request from '.'
import { userStore } from '@/store'

/**
 * 开源项目 / 下载 / 上传审核（前端契约，后端待实现）
 * ------------------------------------------------------------
 * 后端要提供的接口见 docs/后端接口-开源项目.md。
 * 在接口就绪前，本模块用「本地兜底数据 + 本地暂存提交」保证页面可看可用：
 *   - 列表：接口失败时返回内置的余额兔，不显示空页
 *   - 上传：接口失败时把提交写进 localStorage，状态标为「待审核（本地暂存）」
 */

export type ProjectPlatform = 'windows' | 'macos' | 'linux'

export type ProjectRelease = {
  id: number | string
  version: string
  platform: ProjectPlatform
  /** 安装包直链或网盘地址 */
  file_url: string
  file_size?: string
  changelog?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
  reviewer_note?: string
}

export type OpenSourceProject = {
  id: number | string
  name: string
  summary: string
  description?: string
  repo_url?: string
  author_name?: string
  official?: boolean
  /** 每个平台最新一个已审核版本 */
  releases: ProjectRelease[]
  status?: 'pending' | 'approved' | 'rejected'
  /** 项目封面（社卡图），没有就用纯色占位 */
  cover_url?: string
  updated_at?: string
}

export type SubmitProjectPayload = {
  name: string
  summary: string
  repo_url?: string
  version: string
  changelog?: string
  releases: { platform: ProjectPlatform; file_url: string }[]
}

const LOCAL_KEY = 'anygpt_open_source_submissions'

/** 后端未就绪时的兜底项目：余额兔 */
export const FALLBACK_PROJECTS: OpenSourceProject[] = [
  {
    id: 'balance-bunny',
    name: '余额兔',
    summary: '桌面小宠物，抬头就能看到余额和最近用量，不用再登录网页查。',
    description:
      '常驻托盘的小兔子：鼠标移上去显示当前余额、今日消耗 token、本月消费；余额低于你设的阈值会提醒。只读取你自己的密钥，不做任何上传。',
    author_name: 'anyGPT 官方',
    official: true,
    status: 'approved',
    repo_url: '',
    cover_url: '/covers/yuebao.svg',
    releases: [
      {
        id: 'bb-win',
        version: '1.3.0',
        platform: 'windows',
        file_url: 'https://raw.githubusercontent.com/rabbit16/chatgpt-web/feature/dev/public/downloads/yuebao-v1.3.0-windows.zip',
        file_size: '414 KB',
        changelog: '免安装版，解压后直接运行；修复托盘余额刷新延迟。',
        status: 'approved'
      },
      {
        id: 'bb-mac',
        version: '1.2.4',
        platform: 'macos',
        file_url: 'https://raw.githubusercontent.com/rabbit16/chatgpt-web/feature/dev/public/downloads/yuebao-v1.2.4-macos.zip',
        file_size: '891 KB',
        changelog: 'macOS 版，解压后拖入「应用程序」；首次打开需在「隐私与安全性」中允许。',
        status: 'approved'
      },
      { id: 'bb-linux', version: '', platform: 'linux', file_url: '', status: 'pending' }
    ]
  }
]

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 隐私模式下写不进去就只存在内存里，页面照常提示
  }
}

/** 当前登录用户的 token，上传接口需要带 */
function authHeaders() {
  const token = userStore.getState().token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * 已上架项目列表（公开）
 * GET /open-source/projects
 */
export async function getOpenSourceProjects(): Promise<OpenSourceProject[]> {
  try {
    const res: any = await request.get('/open-source/projects')
    const list = res?.data?.list ?? res?.data ?? []
    if (Array.isArray(list) && list.length) return list as OpenSourceProject[]
    return FALLBACK_PROJECTS
  } catch {
    return FALLBACK_PROJECTS
  }
}

/**
 * 我的提交（含待审核）
 * GET /open-source/my-projects
 */
export async function getMySubmissions(): Promise<OpenSourceProject[]> {
  const local = readLocal<OpenSourceProject[]>(LOCAL_KEY, [])
  try {
    const res: any = await request.get('/open-source/my-projects', undefined, { headers: authHeaders() })
    const list = res?.data?.list ?? res?.data ?? []
    if (Array.isArray(list)) {
      // 接口有数据就合并本地暂存（本地未同步的排在前面）
      return [...local.filter((item) => item.id.startsWith('local-')), ...list]
    }
    return local
  } catch {
    return local
  }
}

/**
 * 提交新项目或新版本（需要登录，进后台待审核）
 * POST /open-source/projects
 */
export async function submitProject(payload: SubmitProjectPayload): Promise<{ ok: boolean; local: boolean }> {
  try {
    await request.post('/open-source/projects', payload, { headers: authHeaders() })
    return { ok: true, local: false }
  } catch {
    const local = readLocal<OpenSourceProject[]>(LOCAL_KEY, [])
    const token = userStore.getState().token
    const record: OpenSourceProject = {
      id: `local-${Date.now()}`,
      name: payload.name,
      summary: payload.summary,
      repo_url: payload.repo_url,
      author_name: token ? '我' : '未登录',
      status: 'pending',
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      releases: payload.releases.map((item, index) => ({
        id: `local-${Date.now()}-${index}`,
        version: payload.version,
        platform: item.platform,
        file_url: item.file_url,
        changelog: payload.changelog,
        status: 'pending'
      }))
    }
    writeLocal(LOCAL_KEY, [record, ...local])
    return { ok: true, local: true }
  }
}

export const PLATFORM_LABEL: Record<ProjectPlatform, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux'
}
