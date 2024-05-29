import { TypedTransaction } from '@ethereumjs/tx'
import { bytesToHex } from '@ethereumjs/util'

import { TxResult } from './types'

export class TransactionIndexer {
  readonly #transactions: Map<string, TypedTransaction>
  readonly #results: Map<string, TxResult & { blockNumber?: bigint }>

  constructor() {
    this.#transactions = new Map()
    this.#results = new Map()
  }

  indexTransaction(
    tx: TypedTransaction,
    result: TxResult,
    blockNumber?: bigint,
  ) {
    const hash = bytesToHex(result.hash)
    this.#transactions.set(hash, tx)
    this.#results.set(hash, {
      ...result,
      blockNumber,
    })
  }

  getTransaction(hash: string) {
    return this.#transactions.get(hash)
  }

  getResult(hash: string) {
    return this.#results.get(hash)
  }
}
