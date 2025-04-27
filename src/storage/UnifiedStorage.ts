import { BaseStorage } from './BaseStorage'
import {
  RangeItem,
  StorageAPI,
  StorageData,
  StorageKey,
  TransactionFunction,
} from './StorageAPI'

type TaskCallback = (value: unknown) => void

type DBTask = {
  dbName: string
  storeName: string
  callback: TaskCallback
}

type InitTask = {
  operation: 'init'
} & DBTask

type GetTask = {
  operation: 'get'
  key: StorageKey
} & DBTask

type GetRangeTask = {
  operation: 'getRange'
  prefix: StorageKey
} & DBTask

type SetTask = {
  operation: 'set'
  key: StorageKey
  value: StorageData
} & DBTask

type RemoveTask = {
  operation: 'remove'
  key: StorageKey
} & DBTask

type RemoveRangeTask = {
  operation: 'removeRange'
  prefix: StorageKey
} & DBTask

type TransactionTask = {
  operation: 'transaction'
  func: TransactionFunction
  callback: TaskCallback
} & DBTask

type DestroyTask = {
  operation: 'destroy'
} & DBTask

type Task =
  | InitTask
  | GetTask
  | GetRangeTask
  | SetTask
  | RemoveTask
  | RemoveRangeTask
  | TransactionTask
  | DestroyTask

export class UnifiedStorage extends BaseStorage {
  readonly #dbName: string
  readonly #storeName: string
  static #backends: Record<string, StorageAPI> = {}
  static readonly #tasks: Task[] = []
  static #isRunning = true

  protected constructor(dbName: string, storeName: string) {
    super()
    this.#dbName = dbName
    this.#storeName = storeName
  }

  get(key: StorageKey): Promise<Uint8Array | null> {
    return UnifiedStorage.#get(this.#dbName, this.#storeName, key)
  }

  getRange(prefix: StorageKey): Promise<RangeItem[] | null> {
    return UnifiedStorage.#getRange(this.#dbName, this.#storeName, prefix)
  }

  doSet(key: StorageKey, value: Uint8Array): Promise<void> {
    return UnifiedStorage.#set(this.#dbName, this.#storeName, key, value)
  }

  remove(key: StorageKey): Promise<void> {
    return UnifiedStorage.#remove(this.#dbName, this.#storeName, key)
  }

  removeRange(prefix: StorageKey): Promise<void> {
    return UnifiedStorage.#removeRange(this.#dbName, this.#storeName, prefix)
  }

  destroy(): Promise<void> {
    return UnifiedStorage.#destroy(this.#dbName, this.#storeName)
  }

  async transaction(func: TransactionFunction): Promise<void> {
    return UnifiedStorage.#transaction(this.#dbName, this.#storeName, func)
  }

  static async create(
    dbName: string,
    storeName: string,
  ): Promise<UnifiedStorage> {
    const storage = new UnifiedStorage(dbName, storeName)
    await this.#init(dbName, storeName)
    return storage
  }

  static async start() {
    if (!this.#isRunning) {
      throw new Error('Storage service is already stopped')
    }

    while (this.#isRunning || this.#tasks.length > 0) {
      const task = this.#tasks.shift()
      if (!task) {
        await new Promise((resolve) => setTimeout(resolve, 1))
        continue
      }

      switch (task.operation) {
        case 'get':
          await this.#handleGet(task)
          break
        case 'set':
          await this.#handleSet(task)
          break
        case 'remove':
          await this.#handleRemove(task)
          break
        case 'init':
          await this.#handleInit(task)
          break
        case 'transaction':
          await this.#handleTransaction(task)
          break
        case 'getRange':
          await this.#handleGetRange(task)
          break
        case 'removeRange':
          await this.#handleRemoveRange(task)
          break
        case 'destroy':
          await this.#handleDestroy(task)
          break
      }
    }
  }

  /**
   * Stops the storage service. The service will process all pending tasks
   * before stopping.
   */
  static stop() {
    this.#isRunning = false
  }

  static #transaction(
    dbName: string,
    storeName: string,
    func: TransactionFunction,
  ) {
    return new Promise<void>((resolve) => {
      UnifiedStorage.#tasks.push({
        operation: 'transaction',
        dbName: dbName,
        storeName: storeName,
        func,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleTransaction(task: TransactionTask) {
    const { dbName, storeName, func, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    const value = await func(backend)
    callback(value)
  }

  static #init(dbName: string, storeName: string) {
    return new Promise((resolve) => {
      this.#tasks.push({
        operation: 'init',
        dbName,
        storeName,
        callback: resolve,
      })
    })
  }

  static async #handleInit(task: InitTask) {
    const { dbName, storeName, callback } = task
    if (!this.#backends[`${dbName}:${storeName}`]) {
      this.#backends[`${dbName}:${storeName}`] = await this.#createStore(
        dbName,
        storeName,
      )
    }
    callback(undefined)
  }

  static #get(
    dbName: string,
    storeName: string,
    key: StorageKey,
  ): Promise<Uint8Array | null> {
    return new Promise<Uint8Array | null>((resolve) => {
      this.#tasks.push({
        operation: 'get',
        dbName,
        storeName,
        key,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleGet(task: GetTask) {
    const { dbName, storeName, key, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    const value = await backend.get(key)
    callback(value)
  }

  static #getRange(
    dbName: string,
    storeName: string,
    prefix: StorageKey,
  ): Promise<RangeItem[] | null> {
    return new Promise<RangeItem[] | null>((resolve) => {
      this.#tasks.push({
        operation: 'getRange',
        dbName,
        storeName,
        prefix,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleGetRange(task: GetRangeTask) {
    const { dbName, storeName, prefix, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    const value = await backend.getRange(prefix)
    callback(value)
  }

  static #set(
    dbName: string,
    storeName: string,
    key: StorageKey,
    value: StorageData,
  ) {
    return new Promise<void>((resolve) => {
      this.#tasks.push({
        operation: 'set',
        dbName,
        storeName,
        key,
        value,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleSet(task: SetTask) {
    const { dbName, storeName, key, value, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    await backend.set(key, value)
    callback(undefined)
  }

  static #remove(dbName: string, storeName: string, key: StorageKey) {
    return new Promise<void>((resolve) => {
      this.#tasks.push({
        operation: 'remove',
        dbName,
        storeName,
        key,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleRemove(task: RemoveTask) {
    const { dbName, storeName, key, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    await backend.remove(key)
    callback(undefined)
  }

  static #removeRange(dbName: string, storeName: string, prefix: StorageKey) {
    return new Promise<void>((resolve) => {
      this.#tasks.push({
        operation: 'removeRange',
        dbName,
        storeName,
        prefix,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleRemoveRange(task: RemoveRangeTask) {
    const { dbName, storeName, prefix, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    await backend.removeRange(prefix)
    callback(undefined)
  }

  static async #destroy(dbName: string, storeName: string) {
    return new Promise<void>((resolve) => {
      this.#tasks.push({
        operation: 'destroy',
        dbName,
        storeName,
        callback: resolve as TaskCallback,
      })
    })
  }

  static async #handleDestroy(task: DestroyTask) {
    const { dbName, storeName, callback } = task
    const backend = this.#backends[`${dbName}:${storeName}`]
    await backend.destroy()
    delete this.#backends[`${dbName}:${storeName}`]
    callback(undefined)
  }

  static async #createStore(
    dbName: string,
    storeName: string,
  ): Promise<StorageAPI> {
    if (
      typeof window !== 'undefined' &&
      typeof window?.indexedDB === 'object'
    ) {
      const { IndexedDBStorage } = await import('./IndexedDBStorage')
      return new IndexedDBStorage(dbName, storeName)
    }

    if (typeof process === 'object' && process?.versions?.node) {
      const { FileStorage } = await import('./FileStorage')
      const { homedir } = await import('os')
      const { join } = await import('path')
      const directory = join(homedir(), '.bonadocs', 'storage', dbName)
      return await FileStorage.create(directory, storeName)
    }

    throw new Error('No storage implementation available for this environment')
  }
}
