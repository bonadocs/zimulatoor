import { StorageAPI } from './StorageAPI'
import { UnifiedStorage } from './UnifiedStorage'
import { deleteCollectionName, getLocalCollectionNames } from './name-indexer'

let apiCache: StorageAPI | undefined = undefined
let zimulatoorTagCache: StorageAPI | undefined = undefined

export { getLocalCollectionNames, deleteCollectionName }

UnifiedStorage.start().catch((e) => {
  throw e
})

export const stopUnifiedStorage = () => {
  UnifiedStorage.stop()
}

export async function getApiCache(): Promise<StorageAPI> {
  if (!apiCache) {
    apiCache = await UnifiedStorage.create('cached-api-calls', 'index')
  }

  return apiCache
}

export async function getZimulatoorTagCache(): Promise<StorageAPI> {
  if (!zimulatoorTagCache) {
    zimulatoorTagCache = await UnifiedStorage.create(
      'zimulatoor-tag-cache',
      'index',
    )
  }

  return zimulatoorTagCache
}
