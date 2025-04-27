import { RangeItem, StorageAPI, StorageData, StorageKey } from './StorageAPI'

export abstract class BaseStorage implements StorageAPI {
  protected constructor() {}

  async getString(key: StorageKey): Promise<string | null> {
    const data = await this.get(this.normalizeKey(key))
    return data ? new TextDecoder().decode(data) : null
  }

  async set(key: StorageKey, value: StorageData): Promise<void> {
    await this.doSet(
      this.normalizeKey(key),
      value instanceof Uint8Array ? value : new TextEncoder().encode(value),
    )
  }

  normalizeKey(key: StorageKey): string[] {
    return Array.isArray(key) ? key : [key]
  }

  abstract get(key: StorageKey): Promise<Uint8Array | null>
  abstract getRange(prefix: StorageKey): Promise<RangeItem[] | null>
  abstract doSet(key: StorageKey, value: Uint8Array): Promise<void>
  abstract remove(key: StorageKey): Promise<void>
  abstract removeRange(prefix: StorageKey): Promise<void>
  abstract transaction(
    func: (store: StorageAPI) => Promise<void>,
  ): Promise<void>
  abstract destroy(): Promise<void>
}
