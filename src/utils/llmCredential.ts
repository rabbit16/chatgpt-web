const SELECTION_STORAGE = 'rabbitj_api_key_selection'
const LEGACY_SECRET_STORAGE = 'rabbitj_api_secrets'
const sessionSecrets: Record<string, Record<string, string>> = {}

try {
  localStorage.removeItem(LEGACY_SECRET_STORAGE)
} catch {
  // Storage may be unavailable in restricted browser contexts.
}

type SecretBucket = {
  selectedId?: number | 'phone'
}

function readUserInfo(userInfo: any) {
  return userInfo?.data?.bodyMessage || userInfo?.bodyMessage || userInfo || {}
}

export function readUserId(userInfo: any): string {
  const body = readUserInfo(userInfo)
  const id = body.userId ?? body.user_id ?? userInfo?.userId
  return id == null ? '' : String(id)
}

export function readPhone(userInfo: any): string {
  const body = readUserInfo(userInfo)
  const candidates = [body.telephone, userInfo?.telephone, body.userName]
  return candidates.find((value) => /^1[3-9]\d{9}$/.test(String(value || ''))) || ''
}

export function readAllowPhoneKey(userInfo: any): boolean | null {
  const body = readUserInfo(userInfo)
  if (typeof body.allow_phone_key === 'boolean') return body.allow_phone_key
  return null
}

function loadSelections(): Record<string, SecretBucket> {
  try {
    const raw = localStorage.getItem(SELECTION_STORAGE)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveSelections(all: Record<string, SecretBucket>) {
  localStorage.setItem(SELECTION_STORAGE, JSON.stringify(all))
}

function selectionOf(userId: string): SecretBucket {
  return loadSelections()[userId] || {}
}

export function rememberCreatedKey(userId: string, id: number, secret: string) {
  if (!userId || !secret) return
  sessionSecrets[userId] ||= {}
  sessionSecrets[userId][String(id)] = secret
  selectStoredKey(userId, id)
}

export function selectStoredKey(userId: string, selectedId: number | 'phone') {
  if (!userId) return
  const all = loadSelections()
  all[userId] = { selectedId }
  saveSelections(all)
}

export function storedSecret(userId: string, id: number): string {
  return sessionSecrets[userId]?.[String(id)] || ''
}

export function forgetStoredKey(userId: string, id: number) {
  const bucket = sessionSecrets[userId]
  if (bucket) delete bucket[String(id)]
  if (storedSelection(userId) === id) {
    const all = loadSelections()
    delete all[userId]
    saveSelections(all)
  }
}

export function storedSelection(userId: string): number | 'phone' | undefined {
  return selectionOf(userId).selectedId
}

type KeyRow = { id: number; is_active: boolean; api_key?: string }

export function syncCredential(userInfo: any, allowPhoneKey: boolean, keys: KeyRow[]) {
  const userId = readUserId(userInfo)
  if (!sessionSecrets[userId]) sessionSecrets[userId] = {}
  const phone = readPhone(userInfo)
  const secrets = sessionSecrets[userId] || {}
  for (const item of keys) {
    if (item.api_key) secrets[String(item.id)] = item.api_key
  }
  const activeIds = new Set(keys.filter((item) => item.is_active).map((item) => item.id))
  const selected = storedSelection(userId)
  let nextKey = ''
  if (selected === 'phone' && allowPhoneKey && phone) {
    nextKey = phone
  } else if (typeof selected === 'number' && activeIds.has(selected) && secrets[String(selected)]) {
    nextKey = secrets[String(selected)]
  } else {
    const fallback = keys.find((item) => item.is_active && secrets[String(item.id)])
    if (fallback) {
      nextKey = secrets[String(fallback.id)]
      selectStoredKey(userId, fallback.id)
    } else if (allowPhoneKey && phone) {
      nextKey = phone
      selectStoredKey(userId, 'phone')
    }
  }
  return nextKey
}
