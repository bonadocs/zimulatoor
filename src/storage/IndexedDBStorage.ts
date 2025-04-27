import { BaseStorage } from './BaseStorage'
import { RangeItem, StorageKey } from './StorageAPI'

/**
 * A storage implementation that uses the IndexedDB API.
 */
export class IndexedDBStorage extends BaseStorage {
  readonly #dbPromise: Promise<void>
  #db: IDBDatabase | null = null
  #storeName = 'key-value-store'

  constructor(
    private readonly dbName: string,
    private readonly dataKey: string,
    private readonly version = 1,
  ) {
    super()
    this.#dbPromise = this.openDatabase()
      .then((db) => {
        this.#db = db
      })
      .catch((err) => {
        throw new Error(`Failed to open database: ${err}`)
      })
  }

  transaction(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => {
        reject(request.error)
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.#storeName)) {
          db.createObjectStore(this.#storeName)
        }
      }
    })
  }

  async get(key: StorageKey): Promise<Uint8Array | null> {
    key = this.getFullKey(key)
    await this.#dbPromise
    return new Promise((resolve, reject) => {
      const transaction = this.#db!.transaction(this.#storeName, 'readonly')
      const request = transaction.objectStore(this.#storeName).get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async getRange(prefix: StorageKey): Promise<RangeItem[] | null> {
    prefix = this.getFullKey(prefix)
    await this.#dbPromise
    return new Promise((resolve, reject) => {
      const transaction = this.#db!.transaction(this.#storeName, 'readonly')
      const store = transaction.objectStore(this.#storeName)
      const lowerBound = prefix
      const upperBound = [...prefix, '\uffff']
      const range = IDBKeyRange.bound(lowerBound, upperBound)
      const request = store.openCursor(range)
      const items: RangeItem[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue
        if (cursor) {
          items.push({
            data: cursor.value,
            key: cursor.key as StorageKey,
          })
          cursor.continue()
        } else {
          resolve(items)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async doSet(key: StorageKey, value: Uint8Array): Promise<void> {
    key = this.getFullKey(key)
    await this.#dbPromise
    return new Promise((resolve, reject) => {
      const transaction = this.#db!.transaction(this.#storeName, 'readwrite')
      transaction.objectStore(this.#storeName).put(value, key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async remove(key: StorageKey): Promise<void> {
    key = this.getFullKey(key)
    await this.#dbPromise
    return new Promise((resolve, reject) => {
      const transaction = this.#db!.transaction(this.#storeName, 'readwrite')
      transaction.objectStore(this.#storeName).delete(key)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async removeRange(prefix: StorageKey): Promise<void> {
    prefix = this.getFullKey(prefix)
    await this.#dbPromise
    return new Promise((resolve, reject) => {
      const transaction = this.#db!.transaction(this.#storeName, 'readwrite')
      const store = transaction.objectStore(this.#storeName)
      const lowerBound = prefix
      const upperBound = [...prefix, '\uffff']
      const range = IDBKeyRange.bound(lowerBound, upperBound)
      store.delete(range)

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async destroy(): Promise<void> {
    await this.#dbPromise
    return new Promise((resolve, reject) => {
      try {
        this.#db!.deleteObjectStore(this.#storeName)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  private getFullKey(key: StorageKey): StorageKey {
    return [this.dataKey, ...this.normalizeKey(key)]
  }
}
