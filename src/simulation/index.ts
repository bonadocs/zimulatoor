import { Block } from '@ethereumjs/block'
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

import { SignatureMatcher } from './signature-matcher'
import { TransactionIndexer } from './transaction-indexer'
import { populateTransaction } from './tx'
import { CallResult, TxResult } from './types'

export class SimulationEngine {
  readonly #jsonRpcProvider: JsonRpcProvider
  readonly #transactionIndexer: TransactionIndexer
  readonly #signatureMatcher: SignatureMatcher
  readonly vm: VM
  readonly forkBlockNumber: bigint
  readonly chainId: bigint
  #blockNumber: bigint
  #lastTimestamp: number

  private constructor(
    jsonRpcProvider: JsonRpcProvider,
    vm: VM,
    forkBlockNumber: bigint,
    chainId: bigint,
    signatureMatcher: SignatureMatcher,
  ) {
    this.#jsonRpcProvider = jsonRpcProvider
    this.vm = vm
    this.forkBlockNumber = forkBlockNumber
    this.chainId = chainId
    this.#transactionIndexer = new TransactionIndexer()
    this.#signatureMatcher = signatureMatcher
    this.#blockNumber = forkBlockNumber
    this.#lastTimestamp = Date.now()
  }

  get blockNumber() {
    return this.resolveBlockNumber(this.#blockNumber)
  }

  isSimulatedBlockNumber(blockNumber: bigint) {
    return blockNumber > this.forkBlockNumber
  }

  resolveBlockNumber(blockNumber: bigint) {
    return this.forkBlockNumber + blockNumber
  }

  reverseBlockNumber(blockNumber: bigint) {
    return blockNumber - this.forkBlockNumber
  }

  static async create(jsonRpcProvider: JsonRpcProvider, blockNumber?: bigint) {
    blockNumber ??= BigInt(await jsonRpcProvider.getBlockNumber())
    const signatureMatcher = new SignatureMatcher()
    const vm = await createVM({
      provider: jsonRpcProvider,
      blockNumber,
      signatureMatcher: signatureMatcher,
    })
    const chainId = await jsonRpcProvider
      ._detectNetwork()
      .then((n) => BigInt(n.chainId))
    return new SimulationEngine(
      jsonRpcProvider,
      vm,
      blockNumber,
      chainId,
      signatureMatcher,
    )
  }

  /**
   * Impersonates an account and returns the impersonation private key. This is
   * required for indexing and for signature verification to work on
   * impersonated accounts. For simpler use-cases without signature
   * verification and when indexing is not required, you can impersonate an
   * account without calling this method.
   * @param publicKey
   */
  impersonateAccount(publicKey: string): Uint8Array {
    this.#signatureMatcher.registerSimulationPublicKey(hexToBytes(publicKey))
    return this.#signatureMatcher.getSimulationPrivateKey(publicKey)
  }

  async setBalance(address: string, balance: bigint) {
    const addr = Address.fromString(address)
    const account = await this.vm.stateManager.getAccount(addr)
    if (!account) {
      await this.vm.stateManager.putAccount(addr)
    }

    await this.vm.stateManager.modifyAccountFields(addr, {
      balance,
    })
  }

  async setStorage(address: string, key: string, value: string) {
    const addr = Address.fromString(address)
    await this.vm.stateManager.putContractStorage(
      addr,
      hexToBytes(key),
      hexToBytes(value),
    )
  }

  getTransaction(hash: string) {
    return this.#transactionIndexer.getTransaction(hash)
  }

  getTransactionResult(hash: string) {
    return this.#transactionIndexer.getResult(hash)
  }

  async execute(tx: TransactionRequest): Promise<TxResult> {
    const transaction = await this.#prepareTransaction(tx)
    const results = await this.#executeTransactions([transaction])
    return results[0]
  }

  async executeTypedTransaction(tx: TypedTransaction): Promise<TxResult> {
    const results = await this.#executeTransactions([tx])
    return results[0]
  }

  async executeBundle(txs: TransactionRequest[]): Promise<TxResult[]> {
    const transactions = await Promise.all(
      txs.map((tx) => this.#prepareTransaction(tx)),
    )
    return this.#executeTransactions(transactions)
  }

  async #prepareTransaction(tx: TransactionRequest) {
    const populated = await populateTransaction({
      vm: this.vm,
      provider: this.#jsonRpcProvider,
      tx,
      signatureMatcher: this.#signatureMatcher,
    })

    let typedTx: TypedTransaction
    switch (populated.type) {
      case '0x2':
        typedTx = initializeSimulationTransaction(
          FeeMarketEIP1559Transaction,
          {
            ...populated,
            from: tx.from as string,
            gasPrice: undefined,
            maxFeePerGas: populated.maxFeePerGas!,
            gasLimit: populated.gas,
          },
          {
            common: this.vm.common,
          },
          this.#signatureMatcher,
        )
        break
      case '0x1':
        typedTx = initializeSimulationTransaction(
          AccessListEIP2930Transaction,
          {
            ...populated,
            from: tx.from as string,
            gasLimit: populated.gas,
          },
          {
            common: this.vm.common,
          },
          this.#signatureMatcher,
        )
        break
      default:
        typedTx = initializeSimulationTransaction(
          LegacyTransaction,
          {
            ...populated,
            from: tx.from as string,
            gasLimit: populated.gas,
          },
          {
            common: this.vm.common,
          },
          this.#signatureMatcher,
        )
    }
    return typedTx
  }

  #executeTransactions(transactions: TypedTransaction[]) {
    const hasUnsignedTransactions = transactions.some(
      (tx) => tx.v == null || tx.r == null || tx.s == null,
    )

    return hasUnsignedTransactions
      ? this.#executeTransactionsWithoutBlock(transactions)
      : this.#executeTransactionsInBlock(transactions)
  }

  async #executeTransactionsInBlock(transactions: TypedTransaction[]) {
    const lastBlock = await this.vm.blockchain.getCanonicalHeadBlock()
    if (
      !lastBlock.header.number &&
      this.#blockNumber !== this.forkBlockNumber
    ) {
      throw new Error('Failed to get last block')
    }

    this.#blockNumber++
    this.#lastTimestamp++

    const totalGasLimit = transactions.reduce(
      (gasLimit, tx) => gasLimit + tx.gasLimit,
      0n,
    )
    const gasLimit =
      totalGasLimit > lastBlock.header.gasLimit
        ? totalGasLimit
        : lastBlock.header.gasLimit

    const block = Block.fromBlockData(
      {
        header: {
          number: this.#blockNumber - this.forkBlockNumber,
          parentHash: lastBlock.hash(),
          timestamp: this.#lastTimestamp,
          gasLimit,
        },
        transactions: transactions,
      },
      { common: this.vm.common },
    )

    const runBlockResult = await this.vm.runBlock({
      block,
      skipBalance: true,
      generate: true,
      skipBlockValidation: true,
    })

    return this.#prepareResults(
      transactions,
      runBlockResult.results,
      this.#blockNumber,
    )
  }

  async #executeTransactionsWithoutBlock(transactions: TypedTransaction[]) {
    const runTxResults = []
    for (const tx of transactions) {
      runTxResults.push(
        await this.vm.runTx({
          tx,
          skipBalance: true,
        }),
      )
    }

    return this.#prepareResults(transactions, runTxResults)
  }

  #prepareResults(
    transactions: TypedTransaction[],
    runTxResults: RunTxResult[],
    blockNumber?: bigint,
  ) {
    const executionResults: TxResult[] = []
    for (let i = 0; i < runTxResults.length; i++) {
      const runTxResult = runTxResults[i]
      const parsedLogs = runTxResult.execResult.logs?.map(
        ([address, topics, data]) => ({
          address: bytesToHex(address),
          topics: topics.map(bytesToHex),
          data: bytesToHex(data),
        }),
      )

      addErrorMessage(runTxResult.execResult)
      let hash: Uint8Array | undefined
      try {
        hash = transactions[i].hash()
      } catch {
        // ignore - hash is not available for unsigned transactions
      }

      const enhancedTxResult = {
        ...runTxResult,
        error: runTxResult.execResult.exceptionError,
        logs: parsedLogs,
        hash,
      } as TxResult

      this.#transactionIndexer.indexTransaction(
        transactions[i],
        enhancedTxResult,
        blockNumber,
      )
      executionResults.push(enhancedTxResult)
    }

    return executionResults
  }

  async call(tx: {
    from: string
    to: string
    data: string
    value?: string
  }): Promise<CallResult> {
    if (!tx.to) {
      throw new Error("'to' address is required")
    }

    const evmResult = await this.vm.evm.runCall({
      caller: Address.fromString(tx.from),
      to: Address.fromString(tx.to),
      data: hexToBytes(tx.data),
      value: tx.value ? BigInt(tx.value) : BigInt(0),
      isStatic: true,
    })

    addErrorMessage(evmResult.execResult)
    return { ...evmResult }
  }
}
