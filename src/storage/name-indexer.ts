import { StorageAPI } from './StorageAPI'
import { UnifiedStorage } from './UnifiedStorage'

let localCollectionNameStore: StorageAPI | null = null

export async function getLocalCollectionNames(
  store?: StorageAPI,
): Promise<Record<string, { name: string; lastAccessTimestamp: number }>> {
  store = store ?? (await getLocalCollectionNameStore())
  const names = await store.getString('collectionNames')
  if (!names) {
    return {}
  }

  return JSON.parse(names)
}

export async function indexCollectionName(collectionId: string, name: string) {
  const store = await getLocalCollectionNameStore()
  await store.transaction(async (store) => {
    const names = await getLocalCollectionNames(store)
    names[collectionId] = {
      name: name,
      lastAccessTimestamp: Date.now(),
    }

    return await store.set('collectionNames', JSON.stringify(names))
  })
}

export async function deleteCollectionName(collectionId: string) {
  const store = await getLocalCollectionNameStore()
  await store.transaction(async (store) => {
    const names = await getLocalCollectionNames(store)
    delete names[collectionId]
    return await store.set('collectionNames', JSON.stringify(names))
  })
}

/**
 * This store is used to store the names of collections that can be managed
 * on this device. This is not a strong guarantee that the collection exists,
 * but it can help with listing collections that can be managed.
 */
async function getLocalCollectionNameStore(): Promise<StorageAPI> {
  if (!localCollectionNameStore) {
    localCollectionNameStore = await UnifiedStorage.create(
      'meta',
      'collections',
    )
  }
  return localCollectionNameStore
}
