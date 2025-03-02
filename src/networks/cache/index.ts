const cacheMap = new Map<string, cacheMapEntry>()

type cacheMapEntry = {
  value: string
  expiry: number
}

function set(key: string, value: string, ttl: number): void {
  const entry: cacheMapEntry = {
    value,
    expiry: Date.now() + ttl * 1000,
  }
  cacheMap.set(key, entry)

  if (typeof localStorage === 'undefined' || !localStorage) {
    return
  }

  localStorage.setItem(key, JSON.stringify(entry))
}

function get(key: string): string | null {
  try {
    const entry = cacheMap.get(key)
    const now = Date.now()

    if (entry && entry.expiry > now) {
      return entry.value
    }

    if (typeof localStorage === 'undefined' || !localStorage) {
      return null
    }

    const stored = localStorage.getItem(key)
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
