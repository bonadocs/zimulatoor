export type TransactionFunction = (store: StorageAPI) => Promise<void>
export type StorageKey = string | string[]
export type StorageData = Uint8Array | string

export type RangeItem = {
  readonly key: StorageKey
  readonly data: StorageData
}

export type StorageAPI = {
  readonly get: (key: StorageKey) => Promise<Uint8Array | null>
  readonly getString: (key: StorageKey) => Promise<string | null>
  readonly getRange: (prefix: StorageKey) => Promise<RangeItem[] | null>
  readonly set: (key: StorageKey, value: StorageData) => Promise<void>
  readonly remove: (key: StorageKey) => Promise<void>
  readonly removeRange: (prefix: StorageKey) => Promise<void>
  readonly transaction: (func: TransactionFunction) => Promise<void>
  readonly destroy: () => Promise<void>
}
