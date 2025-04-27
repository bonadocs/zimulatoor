import { cache } from '../cache'

import {
  getFetchCacheKey,
  isMappedUrl,
  patchManager,
  resolveMappedUrls,
} from './util'

export function patchFetch() {
  const ctxGlobal =
    typeof self !== 'undefined'
      ? self
      : typeof global !== 'undefined'
        ? global
        : typeof globalThis !== 'undefined'
          ? globalThis
          : undefined

  if (typeof ctxGlobal?.fetch !== 'function') {
    return
  }

  const originalFetch = ctxGlobal.fetch
  ctxGlobal.fetch = async function fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: string
    if (typeof input === 'string') {
      url = input
    } else if (typeof input === 'object' && 'url' in input) {
      url = input.url
    } else {
      url = input.toString()
    }

    const { key: cacheKey, body } = (await getFetchCacheKey(input, init)) || {}
    if (cacheKey) {
      const response = await cache.get(cacheKey)
      if (response) {
        const parsed = JSON.parse(response)
        return new Response(
          JSON.stringify({
            ...JSON.parse(parsed.body),
            id: body?.id,
          }),
          parsed,
        )
      }
    }

    // not a mapped URL, proceed with original fetch
    if (!isMappedUrl(url)) {
      return cacheResponse(cacheKey || null, originalFetch(input, init))
    }

    const urls = resolveMappedUrls(url)
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      try {
        const response = await cacheResponse(
          cacheKey || null,
          originalFetch(url, init),
        )
        if (!response.ok) {
          continue
        }

        return response
      } catch (e) {
        if (i === urls.length - 1) {
          throw e
        }
      }
    }

    throw new Error('Failed to fetch any of the mapped URLs')
  }
  patchManager.patched = true
}

async function cacheResponse(
  cacheKey: string | null,
  response: Promise<Response>,
): Promise<Response> {
  if (!cacheKey) {
    return response
  }

  const clone = (await response).clone()
  const body = await clone.text()

  // cache the response for 5 minutes
  await cache.set(cacheKey, JSON.stringify({ ...response, body }), 300)

  return response
}
