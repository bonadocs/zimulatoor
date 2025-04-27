import { networks } from './urls'

type EvmCallData = { method: string; params: []; id?: number }

export const patchManager = {
  patched: false,
}

export const mappedUrlHost = 'http://zimulatoor-url'

export function getMappedUrl(chainId: number) {
  const url = networks.get(chainId)?.[0]
  if (url) {
    return patchManager.patched ? `${mappedUrlHost}?chainId=${chainId}` : url
  }

  throw new Error(`Network ${chainId} not currently supported for simulation`)
}

export function isMappedUrl(url: string) {
  return url.startsWith(mappedUrlHost)
}

export function resolveMappedUrls(url: string) {
  if (!isMappedUrl(url)) {
    throw new Error(`URL ${url} is not a mapped URL`)
  }

  const chainId = Number(url.split('=')[1])
  const urls = networks.get(chainId)
  if (!urls) {
    throw new Error(`Network ${chainId} not currently supported for simulation`)
  }

  return urls
}

export async function getFetchCacheKey(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ key: string; body: EvmCallData } | null> {
  const parts = getRequestParts(input, init)
  if (
    parts.body &&
    typeof parts.body === 'object' &&
    'params' in parts.body &&
    !evmMethodsToCache.includes(parts.body.method)
  ) {
    console.log('SKIP CACHE', parts.body.method)
    return null
  }

  const keyParts = { url: parts.url, method: parts.method, body: parts.body }
  if (!parts.fullBody) {
    return null
  }

  const plainKey = JSON.stringify(keyParts)
  const encodedKey = await digestMessage(plainKey)
  return { key: encodedKey, body: parts.fullBody }
}

const evmMethodsToCache = [
  'eth_chainId',
  'eth_call',
  'eth_estimateGas',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getProof',
  'eth_getAccount',
  'eth_getBalance',
  'eth_getTransactionCount',
]

function getRequestParts(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): {
  url: string
  method: string
  fullBody: EvmCallData | null
  body: EvmCallData | null
} {
  const url = getUrl(input)
  const method = getMethod(input, init)
  const fullBody = tryGetBody(init)
  const body = fullBody
    ? { method: fullBody.method, params: fullBody.params }
    : null

  return { url, method, fullBody, body }
}

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  } else if (typeof input === 'object' && 'url' in input) {
    return input.url
  } else {
    return input.toString()
  }
}

function getMethod(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): string {
  if (typeof input === 'object' && 'method' in input) {
    return input.method.toUpperCase()
  }

  return (init?.method || 'GET').toUpperCase()
}

function tryGetBody(init: RequestInit | undefined): null | EvmCallData {
  if (!init?.body) {
    return null
  }

  if (typeof init.body === 'string') {
    return tryParseEvmCall(init.body)
  }

  if (init.body instanceof Uint8Array) {
    return isValidAscii(init.body) ? handleAsciiBody(init.body) : null
  }

  return null
}

function isValidAscii(uint8Array: Uint8Array): boolean {
  for (let i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] > 127) {
      return false
    }
  }
  return true
}

function handleAsciiBody(uint8Array: Uint8Array): null | EvmCallData {
  return tryParseEvmCall(String.fromCharCode(...uint8Array))
}

function tryParseEvmCall(body: string): EvmCallData | null {
  try {
    const data = JSON.parse(body) as Record<string, unknown>
    if (typeof data.method === 'string' && Array.isArray(data.params)) {
      return data as EvmCallData
    }
    return null
  } catch {
    return null
  }
}

async function digestMessage(message: string) {
  const msgUint8 = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
