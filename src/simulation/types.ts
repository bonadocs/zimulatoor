import { EvmError, EVMResult } from '@ethereumjs/evm'
import { RunTxResult } from '@ethereumjs/vm'

export type EnhancedEvmError = EvmError & { message?: string; data: Uint8Array }

export type TxResult = RunTxResult & {
  hash?: Uint8Array
  error?: EnhancedEvmError
  logs?: Array<{ address: string; topics: string[]; data: string }>
}

export type CallResult = EVMResult & {
  error?: EnhancedEvmError
}
