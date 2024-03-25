import { EvmError, EVMResult } from '@ethereumjs/evm'
import {
  AccessListEIP2930Transaction,
  FeeMarketEIP1559Transaction,
  LegacyTransaction,
  TypedTransaction,
} from '@ethereumjs/tx'
import { Address, bytesToHex, hexToBytes } from '@ethereumjs/util'
import { RunTxResult, VM } from '@ethereumjs/vm'
import { JsonRpcProvider, TransactionRequest } from 'ethers'

import { initializeSimulationTransaction } from '../tx'
import { addErrorMessage } from '../util'
import { createVM } from '../vm'

import { populateTransaction } from './tx'

type TxResult = RunTxResult & {
  error?: EvmError & { message?: string }
  logs?: Array<{ address: string; topics: string[]; data: string }>
}

type CallResult = EVMResult & {
  error?: EvmError & { message?: string }
}

export class SimulationEngine {
  readonly #jsonRpcProvider: JsonRpcProvider
  readonly #vm: VM

  private constructor(jsonRpcProvider: JsonRpcProvider, vm: VM) {
    this.#jsonRpcProvider = jsonRpcProvider
    this.#vm = vm
  }

  static async create(jsonRpcProvider: JsonRpcProvider, blockNumber?: bigint) {
    blockNumber ??= BigInt(await jsonRpcProvider.getBlockNumber())
    const vm = await createVM({
      providerUrl: jsonRpcProvider._getConnection().url,
      blockNumber,
    })
    return new SimulationEngine(jsonRpcProvider, vm)
  }

  async setBalance(address: string, balance: bigint) {
    const addr = Address.fromString(address)
    const account = await this.#vm.stateManager.getAccount(addr)
    if (!account) {
      await this.#vm.stateManager.putAccount(addr)
    }

    await this.#vm.stateManager.modifyAccountFields(addr, {
      balance,
    })
  }

  async setStorage(address: string, key: string, value: string) {
    const addr = Address.fromString(address)
    await this.#vm.stateManager.putContractStorage(
      addr,
      hexToBytes(key),
      hexToBytes(value),
    )
  }

  async execute(tx: TransactionRequest): Promise<TxResult> {
    const populated = await populateTransaction({
      vm: this.#vm,
      provider: this.#jsonRpcProvider,
      tx,
    })

    let typedTx: TypedTransaction
    switch (populated.type) {
      case '0x2':
        typedTx = initializeSimulationTransaction(FeeMarketEIP1559Transaction, {
          ...populated,
          from: tx.from as string,
          gasPrice: undefined,
          maxFeePerGas: populated.maxFeePerGas!,
          gasLimit: populated.gas,
        })
        break
      case '0x1':
        typedTx = initializeSimulationTransaction(
          AccessListEIP2930Transaction,
          {
            ...populated,
            from: tx.from as string,
            gasLimit: populated.gas,
          },
        )
        break
      default:
        typedTx = initializeSimulationTransaction(LegacyTransaction, {
          ...populated,
          from: tx.from as string,
          gasLimit: populated.gas,
        })
    }

    const runTxResult = await this.#vm.runTx({ tx: typedTx, skipBalance: true })
    const parsedLogs = runTxResult.execResult.logs?.map(
      ([address, topics, data]) => ({
        address: bytesToHex(address),
        topics: topics.map(bytesToHex),
        data: bytesToHex(data),
      }),
    )

    addErrorMessage(runTxResult.execResult)
    return {
      ...runTxResult,
      error: runTxResult.execResult.exceptionError,
      logs: parsedLogs,
    }
  }

  async call(tx: {
    from: string
    to: string
    data: string
  }): Promise<CallResult> {
    if (!tx.to) {
      throw new Error("'to' address is required")
    }

    const evmResult = await this.#vm.evm.runCall({
      caller: Address.fromString(tx.from),
      to: Address.fromString(tx.to),
      data: hexToBytes(tx.data),
      isStatic: true,
    })

    addErrorMessage(evmResult.execResult)
    return { ...evmResult }
  }
}
