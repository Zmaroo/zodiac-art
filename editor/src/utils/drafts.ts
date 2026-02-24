type DraftRecord = {
  key: string
  payload: unknown
}

const DB_NAME = 'zodiac_editor'
const DB_VERSION = 1
const STORE_NAME = 'drafts'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

export async function getDraft<T>(key: string): Promise<T | null> {
  if (!key) {
    return null
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(key)
    request.onsuccess = () => {
      const record = request.result as DraftRecord | undefined
      resolve(record ? (record.payload as T) : null)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function setDraft<T>(key: string, payload: T): Promise<void> {
  if (!key) {
    return
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.put({ key, payload })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteDraft(key: string): Promise<void> {
  if (!key) {
    return
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}
