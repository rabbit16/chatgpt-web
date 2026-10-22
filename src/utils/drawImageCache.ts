/** 绘图结果仅存本机 IndexedDB，不上传服务器 */

const DB_NAME = 'chatgpt-web-draw-cache'
const DB_VERSION = 1
const STORE = 'generations'

export type DrawCacheRecord = {
  id: string
  userKey: string
  model: string
  prompt: string
  size?: string
  quality?: string
  /** text 文生图 / img2img 图生图 / edit 修改图片 */
  mode?: 'text' | 'img2img' | 'edit'
  createdAt: number
  timeLabel: string
  billing?: string
  mimeType: string
}

type StoredRow = DrawCacheRecord & { blob: Blob }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error || new Error('无法打开本地图库'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('userKey_createdAt', ['userKey', 'createdAt'], { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const store = tx.objectStore(STORE)
        const result = fn(store)
        tx.oncomplete = () => {
          db.close()
          if (result && 'result' in result) resolve(result.result as T)
          else resolve(undefined)
        }
        tx.onerror = () => {
          db.close()
          reject(tx.error || new Error('本地图库读写失败'))
        }
      })
  )
}

export function drawCacheUserKey(phone?: string): string {
  const p = (phone || '').trim()
  return p || '__local_device__'
}

async function srcToBlob(src: string): Promise<{ blob: Blob; mimeType: string }> {
  if (src.startsWith('data:')) {
    const res = await fetch(src)
    const blob = await res.blob()
    return { blob, mimeType: blob.type || 'image/png' }
  }
  const res = await fetch(src)
  if (!res.ok) throw new Error('无法拉取图片以写入本地缓存')
  const blob = await res.blob()
  return { blob, mimeType: blob.type || 'image/png' }
}

export async function saveDrawImageToCache(
  userKey: string,
  input: {
    model: string
    prompt: string
    src: string
    size?: string
    quality?: string
    mode?: DrawCacheRecord['mode']
    billing?: string
  }
): Promise<DrawCacheRecord> {
  const { blob, mimeType } = await srcToBlob(input.src)
  const createdAt = Date.now()
  const id = `${createdAt}-${Math.random().toString(36).slice(2, 10)}`
  const row: StoredRow = {
    id,
    userKey,
    model: input.model,
    prompt: input.prompt,
    size: input.size,
    quality: input.quality,
    mode: input.mode,
    billing: input.billing,
    createdAt,
    timeLabel: new Date(createdAt).toLocaleString(),
    mimeType,
    blob
  }
  await runTransaction('readwrite', (store) => store.put(row))
  const { blob: _b, ...meta } = row
  return meta
}

export async function countDrawImages(userKey: string): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const index = store.index('userKey_createdAt')
    const range = IDBKeyRange.bound([userKey, 0], [userKey, Number.MAX_SAFE_INTEGER])
    const req = index.count(range)
    req.onsuccess = () => {
      db.close()
      resolve(req.result || 0)
    }
    req.onerror = () => {
      db.close()
      reject(req.error)
    }
  })
}

/** 按生成时间倒序分页（第 1 页为最新） */
export async function listDrawImagesPage(
  userKey: string,
  page: number,
  pageSize: number
): Promise<{ items: DrawCacheRecord[]; total: number }> {
  const total = await countDrawImages(userKey)
  if (total === 0) return { items: [], total: 0 }
  const safePage = Math.max(1, page)
  const skip = (safePage - 1) * pageSize
  const need = Math.min(pageSize, Math.max(0, total - skip))
  if (need <= 0) return { items: [], total }

  const db = await openDb()
  const collected: DrawCacheRecord[] = []

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const index = store.index('userKey_createdAt')
    const range = IDBKeyRange.bound([userKey, 0], [userKey, Number.MAX_SAFE_INTEGER])
    const req = index.openCursor(range, 'prev')
    let skipped = 0

    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }
      if (skipped < skip) {
        skipped += 1
        cursor.continue()
        return
      }
      if (collected.length < need) {
        const value = cursor.value as StoredRow
        const { blob: _b, ...meta } = value
        collected.push(meta)
        cursor.continue()
        return
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })

  return { items: collected, total }
}

export async function getDrawImageBlob(id: string): Promise<Blob | null> {
  const row = (await runTransaction<StoredRow>('readonly', (store) => store.get(id))) as StoredRow | undefined
  return row?.blob || null
}

export async function deleteDrawImage(id: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(id))
}

export async function clearDrawImages(userKey: string): Promise<number> {
  const db = await openDb()
  let removed = 0
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const index = store.index('userKey_createdAt')
    const range = IDBKeyRange.bound([userKey, 0], [userKey, Number.MAX_SAFE_INTEGER])
    const req = index.openCursor(range)
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        resolve()
        return
      }
      cursor.delete()
      removed += 1
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
  return removed
}

export function downloadDrawBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadDrawImage(record: DrawCacheRecord) {
  const blob = await getDrawImageBlob(record.id)
  if (!blob) throw new Error('本地缓存中找不到该图片')
  const ext = (record.mimeType || '').includes('jpeg') ? 'jpg' : 'png'
  const safeModel = record.model.replace(/[^\w.-]+/g, '_').slice(0, 40)
  downloadDrawBlob(blob, `draw-${safeModel}-${record.id.slice(0, 8)}.${ext}`)
}
