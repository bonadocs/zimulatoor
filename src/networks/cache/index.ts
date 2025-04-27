import { getZimulatoorTagCache } from '../../storage'

const cacheMap = new Map<string, cacheMapEntry>()
const persistentCachePromise = getZimulatoorTagCache()

type cacheMapEntry = {
  value: string
  expiry: number
}

async function set(key: string, value: string, ttl: number): Promise<void> {
  const entry: cacheMapEntry = {
    value,
    expiry: Date.now() + ttl * 1000,
  }
  cacheMap.set(key, entry)

  const persistentCache = await persistentCachePromise
  persistentCache.set(key, JSON.stringify(entry)).catch((e) => {
    console.error('failed to read from api cache', e)
  })
}

async function get(key: string): Promise<string | null> {
  try {
    const entry = cacheMap.get(key)
    const now = Date.now()

    if (entry && entry.expiry > now) {
      return entry.value
    }

    const persistentCache = await persistentCachePromise
    const stored = await persistentCache.getString(key)
    if (!stored) {
      return null
    }

    const parsed = JSON.parse(stored)
    if (parsed.expiry > now) {
      cacheMap.set(key, parsed)
      return parsed.value
    }

    return null
  } catch {
    return null
  }
}

export const cache = { set, get }
