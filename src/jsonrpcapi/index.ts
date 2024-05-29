// eslint-disable @typescript-eslint/no-explicit-any

import type { Block } from '@ethereumjs/block'
import {
  AccessListEIP2930Transaction,
  FeeMarketEIP1559Transaction,
  LegacyTransaction,
  TypedTransaction,
} from '@ethereumjs/tx'
import {
  Address,
  bigIntToHex,
  bytesToHex,
  hexToBytes,
  isHexPrefixed,
} from '@ethereumjs/util'
import {
  isAddress,
  JsonRpcApiProvider,
  JsonRpcError,
  JsonRpcPayload,
  JsonRpcResult,
  sha256,
} from 'ethers'

import { SimulationEngine } from '../simulation'

const fallbackToProviderConstantErrorCode = 32552225
const blocklessSimulationBlockNumber = 6094306521n
const blocklessSimulationBlockHash = sha256(
  '0x' + blocklessSimulationBlockNumber.toString(16).padStart(16, '0'),
)

export async function executeJsonRpcFunction(
  engine: SimulationEngine,
  provider: JsonRpcApiProvider,
  payload: JsonRpcPayload,
): Promise<(JsonRpcResult | JsonRpcError) & { jsonrpc?: string }> {
  const fn = registeredFunctions[payload.method as JsonRpcFunctionName]
  if (fn) {
    const result = await fn(engine, payload.params)
    if (result.code !== fallbackToProviderConstantErrorCode) {
      return {
        id: payload.id,
        jsonrpc: payload.jsonrpc,
        result,
      }
    }
  }

  const result = await provider._send(payload)
  return result[0]
}

type JsonRpcParams = JsonRpcPayload['params']
type JsonRpcResultData = JsonRpcResult['result']
type JsonRpcErrorData = JsonRpcError['error']

type SimulationJsonRpcFunction = (
  engine: SimulationEngine,
  params: JsonRpcParams,
) => Promise<JsonRpcResultData | JsonRpcErrorData>

/**
 * The list of JSON-RPC functions that are directly supported by the simulation
 * engine. All other functions should be forwarded to a backup provider.
 *
 * Some unsupported functions might use real blockchain data, which could
 * potentially lead to inconsistencies between the simulation and the real
 * blockchain. An example of this is `eth_getProof`.
 *
 * For eth_call and eth_estimateGas, the only block-related value supported
 * is 'latest'. If you want to simulate a past block number, you should
 * set the block number at the point of creation of the SimulationEngine.
 */
const supportedJsonRpcFunctions = [
  'eth_blockNumber',
  'eth_call',
  'eth_estimateGas',
  'eth_getBalance',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getBlockTransactionCountByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionByBlockHashAndIndex',
  'eth_getTransactionByBlockNumberAndIndex',
  'eth_getTransactionReceipt',
  'eth_sendRawTransaction',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_sendTransaction',
  // 'eth_getLogs',
] as const

type JsonRpcFunctionName = (typeof supportedJsonRpcFunctions)[number]

const registeredFunctions: Record<
  JsonRpcFunctionName,
  SimulationJsonRpcFunction
> = {
  async eth_blockNumber(
    engine: SimulationEngine,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    return bigIntToHex(engine.blockNumber)
  },
  async eth_call(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const callResult = await getCallResult(engine, params)
      if (callResult.error) {
        return {
          code: -32000,
          message: callResult.error.message,
          data: bytesToHex(callResult.error.data),
        }
      }

      return bytesToHex(callResult.execResult.returnValue)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_estimateGas(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const callResult = await getCallResult(engine, params)
      if (callResult.error) {
        return {
          code: -32000,
          message: callResult.error.message,
          data: bytesToHex(callResult.error.data),
        }
      }

      return bigIntToHex(callResult.execResult.executionGasUsed)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  /**
   * A warning about the `eth_getBalance` function:
   * The block number parameter is not respected in this implementation.
   * It always uses the latest block.
   * @param engine
   * @param params
   */
  async eth_getBalance(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const balanceParams = params as [string]
      if (!balanceParams[0] || !isAddress(balanceParams[0])) {
        return Promise.resolve({
          code: -32602,
          message: 'Invalid params. "Address" field must be a valid address',
        })
      }

      const account = await engine.vm.stateManager.getAccount(
        Address.fromString(balanceParams[0]),
      )

      if (!account) {
        return '0x0'
      }
      return bigIntToHex(account.balance)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getBlockByHash(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [blockHashParam, includeTxData] = params as [string, boolean]
      if (!isHexPrefixed(blockHashParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockHash" field must be a valid block hash',
        }
      }

      const blockHash = hexToBytes(blockHashParam)

      let block: Block | undefined
      try {
        block = await engine.vm.blockchain.getBlock(blockHash)
      } catch {
        // fallback to provider
      }

      if (block) {
        return evmBlockToJsonRpcBlock(block, includeTxData, engine.chainId)
      }

      return {
        code: fallbackToProviderConstantErrorCode,
      }
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getBlockByNumber(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [blockNumberParam, includeTxData] = params as [string, boolean]
      if (blockNumberParam === 'earliest') {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      if (
        !isHexPrefixed(blockNumberParam) &&
        !['latest', 'pending', 'safe', 'finalized'].includes(blockNumberParam)
      ) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockNumber" field must be a valid block number',
        }
      }

      const blockNumber = isHexPrefixed(blockNumberParam)
        ? BigInt(blockNumberParam)
        : engine.blockNumber

      if (engine.isSimulatedBlockNumber(blockNumber)) {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      const block = await engine.vm.blockchain.getBlock(
        engine.reverseBlockNumber(blockNumber),
      )
      if (!block) {
        return null
      }

      return evmBlockToJsonRpcBlock(block, includeTxData, engine.chainId)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getBlockTransactionCountByHash(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [blockHashParam] = params as [string]
      if (!isHexPrefixed(blockHashParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockHash" field must be a valid block hash',
        }
      }

      const blockHash = hexToBytes(blockHashParam)

      let block
      try {
        block = await engine.vm.blockchain.getBlock(blockHash)
      } catch {
        // fallback to provider
      }

      if (block) {
        return bigIntToHex(BigInt(block.transactions.length))
      }

      return {
        code: fallbackToProviderConstantErrorCode,
      }
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getBlockTransactionCountByNumber(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [blockNumberParam] = params as [string]
      if (blockNumberParam === 'earliest') {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      if (
        !isHexPrefixed(blockNumberParam) &&
        !['latest', 'pending', 'safe', 'finalized'].includes(blockNumberParam)
      ) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockNumber" field must be a valid block number',
        }
      }

      const blockNumber = isHexPrefixed(blockNumberParam)
        ? BigInt(blockNumberParam)
        : engine.blockNumber

      if (blockNumber <= engine.forkBlockNumber) {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      const block = await engine.vm.blockchain.getBlock(
        engine.reverseBlockNumber(blockNumber),
      )
      if (!block) {
        return null
      }

      return bigIntToHex(BigInt(block.transactions.length))
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  /**
   * A warning about the `eth_getCode` function:
   * The block number parameter is not respected in this implementation.
   * It always returns the latest block.
   * @param engine
   * @param params
   */
  async eth_getCode(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [addressParam] = params as [string]
      if (!isAddress(addressParam)) {
        return {
          code: -32602,
          message: 'Invalid params. "Address" field must be a valid address',
        }
      }

      const address = Address.fromString(addressParam)
      const code = await engine.vm.stateManager.getContractCode(address)
      if (!code) {
        return '0x'
      }

      return bytesToHex(code)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  /**
   * A warning about the `eth_getStorageAt` function:
   * The block number parameter is not respected in this implementation.
   * It always returns the latest block.
   * @param engine
   * @param params
   */
  async eth_getStorageAt(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [addressParam, positionParam, blockNumberParam] = params as [
        string,
        string,
        string,
      ]
      if (!isAddress(addressParam)) {
        return {
          code: -32602,
          message: 'Invalid params. "Address" field must be a valid address',
        }
      }

      if (!isHexPrefixed(positionParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "Position" field must be a valid storage position',
        }
      }

      if (
        !isHexPrefixed(blockNumberParam) &&
        !['latest', 'pending', 'safe', 'finalized'].includes(blockNumberParam)
      ) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockNumber" field must be a valid block number',
        }
      }

      const address = Address.fromString(addressParam)
      const position = hexToBytes(positionParam)
      const storage = await engine.vm.stateManager.getContractStorage(
        address,
        position,
      )

      return bytesToHex(storage)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getTransactionByBlockHashAndIndex(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [blockHashParam, indexParam] = params as [string, string]
      if (!isHexPrefixed(blockHashParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockHash" field must be a valid block hash',
        }
      }

      if (!isHexPrefixed(indexParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "Index" field must be a valid transaction index',
        }
      }

      const blockHash = hexToBytes(blockHashParam)
      const index = BigInt(indexParam)

      let block
      try {
        block = await engine.vm.blockchain.getBlock(blockHash)
      } catch {
        // fallback to provider
      }

      if (!block) {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      if (index >= BigInt(block.transactions.length)) {
        return null
      }

      const tx = block.transactions[Number(index)]
      return evmTransactionToJsonRpcTransaction(
        block,
        tx,
        Number(index),
        engine.chainId,
      )
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getTransactionByBlockNumberAndIndex(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [blockNumberParam, indexParam] = params as [string, string]
      if (blockNumberParam === 'earliest') {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      if (
        !isHexPrefixed(blockNumberParam) &&
        !['latest', 'pending', 'safe', 'finalized'].includes(blockNumberParam)
      ) {
        return {
          code: -32602,
          message:
            'Invalid params. "BlockNumber" field must be a valid block number',
        }
      }

      if (!isHexPrefixed(indexParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "Index" field must be a valid transaction index',
        }
      }

      const blockNumber = isHexPrefixed(blockNumberParam)
        ? BigInt(blockNumberParam)
        : engine.blockNumber

      if (blockNumber <= engine.forkBlockNumber) {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      const index = BigInt(indexParam)

      const block = await engine.vm.blockchain.getBlock(
        engine.reverseBlockNumber(blockNumber),
      )
      if (!block || index >= BigInt(block.transactions.length)) {
        return null
      }

      const tx = block.transactions[Number(index)]
      return evmTransactionToJsonRpcTransaction(
        block,
        tx,
        Number(index),
        engine.chainId,
      )
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getTransactionReceipt(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [txHashParam] = params as [string]
      if (!isHexPrefixed(txHashParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "TxHash" field must be a valid transaction hash',
        }
      }

      const tx = engine.getTransaction(txHashParam)
      const result = engine.getTransactionResult(txHashParam)
      if (!tx || !result) {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      const block = result.blockNumber
        ? await engine.vm.blockchain.getBlock(result.blockNumber)
        : undefined
      const blockHash = block
        ? bytesToHex(block.hash())
        : blocklessSimulationBlockHash
      const blockNumber = result.blockNumber
        ? bigIntToHex(engine.resolveBlockNumber(result.blockNumber))
        : bigIntToHex(blocklessSimulationBlockNumber)

      const transactionHash = bytesToHex(tx.hash())
      const transactionIndex = !block
        ? 0
        : '0x' +
          block.transactions
            .findIndex(
              (bTx) =>
                bytesToHex(bTx.hash()).toLowerCase() ===
                txHashParam.toLowerCase(),
            )
            .toString(16)
      return {
        blockHash: blockHash,
        blockNumber: blockNumber,
        contractAddress:
          result.execResult.createdAddresses?.values().next()?.value || null,
        cumulativeGasUsed: bigIntToHex(result.receipt.cumulativeBlockGasUsed),
        effectiveGasPrice: bigIntToHex(
          (result.amountSpent - tx.value) / result.execResult.executionGasUsed,
        ),
        from: tx.getSenderAddress().toString(),
        gasUsed: bigIntToHex(result.totalGasSpent),
        logs:
          result.logs?.map((log, index) => ({
            address: log.address,
            blockHash: blockHash,
            blockNumber: blockNumber,
            data: log.data,
            logIndex: '0x' + index.toString(16),
            removed: false,
            topics: log.topics,
            transactionHash,
            transactionIndex,
          })) || [],
        logsBloom: bytesToHex(result.bloom.bitvector),
        transactionHash,
        transactionIndex,
        to: tx.to?.toString() || null,
        status:
          'status' in result.receipt
            ? result.receipt.status
              ? '0x1'
              : '0x0'
            : undefined,
        root:
          'stateRoot' in result.receipt
            ? bytesToHex(result.receipt.stateRoot)
            : undefined,
      }
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_sendRawTransaction(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [signedTransaction] = params as [string]

      if (!isHexPrefixed(signedTransaction)) {
        return {
          code: -32602,
          message:
            'Invalid params. "Transaction Data" field must be a valid transaction hash',
        }
      }

      const transactionBytes = hexToBytes(signedTransaction)
      let typedTx: TypedTransaction
      try {
        typedTx =
          AccessListEIP2930Transaction.fromSerializedTx(transactionBytes)
      } catch {
        try {
          typedTx =
            FeeMarketEIP1559Transaction.fromSerializedTx(transactionBytes)
        } catch {
          typedTx = LegacyTransaction.fromSerializedTx(transactionBytes)
        }
      }

      const result = await engine.executeTypedTransaction(typedTx)
      if (result.error) {
        return {
          code: -32000,
          message: result.error.message,
          data: bytesToHex(result.error.data),
        }
      }

      return bytesToHex(typedTx.hash())
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getTransactionByHash(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [txHashParam] = params as [unknown]
      if (typeof txHashParam === 'string' && !isHexPrefixed(txHashParam)) {
        return {
          code: -32602,
          message:
            'Invalid params. "TxHash" field must be a valid transaction hash',
        }
      } else if (typeof txHashParam === 'object' && txHashParam) {
        // ethers sends the execution result as an object when execution fails
        return txHashParam // we return the failure result as is
      } else if (typeof txHashParam !== 'string') {
        return {
          code: -32602,
          message:
            'Invalid params. "TxHash" field must be a valid transaction hash',
        }
      }

      const tx = engine.getTransaction(txHashParam)
      const result = engine.getTransactionResult(txHashParam)
      if (!tx || !result) {
        return {
          code: fallbackToProviderConstantErrorCode,
        }
      }

      const block = result.blockNumber
        ? await engine.vm.blockchain.getBlock(result.blockNumber)
        : undefined
      return evmTransactionToJsonRpcTransaction(block, tx, 0, engine.chainId)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_getTransactionCount(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [addressParam] = params as [string]
      if (!isAddress(addressParam)) {
        return {
          code: -32602,
          message: 'Invalid params. "Address" field must be a valid address',
        }
      }

      const address = Address.fromString(addressParam)
      const account = await engine.vm.stateManager.getAccount(address)
      if (!account) {
        return bigIntToHex(0n)
      }
      return bigIntToHex(account.nonce)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  async eth_sendTransaction(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {
    try {
      const [tx] = params as [CallPayload]
      if (!tx.from) {
        return {
          code: -32602,
          message: 'Invalid params. "from" field is required',
        }
      }

      const result = await engine.execute(callPayloadToTxRequest(tx))
      if (result.error) {
        return {
          code: -32000,
          message: result.error.message,
          data: bytesToHex(result.error.data),
        }
      }

      return bytesToHex(result.execResult.returnValue)
    } catch (error) {
      return genericExceptionHandler(error)
    }
  },
  /* async eth_getLogs(
    engine: SimulationEngine,
    params: JsonRpcParams,
  ): Promise<JsonRpcResultData | JsonRpcErrorData> {

  }, */
}

type CallPayload = {
  from: string
  to: string
  input: string
  value?: string
}
function getCallResult(engine: SimulationEngine, params: JsonRpcParams) {
  const callParams = params as [CallPayload]
  if (!callParams[0]?.from) {
    throw new Error(
      'JSON_RPC_API_INVALID_PARAMS- Invalid params. "from" field is required',
    )
  }

  return engine.call(callPayloadToTxRequest(callParams[0]))
}

function genericExceptionHandler(error: unknown) {
  if (!(error instanceof Error) || !error.message.startsWith('JSON_RPC_API')) {
    throw error
  }

  const message = error.message.split('-')[1].trim()
  return {
    code: -32602,
    message: message,
  }
}

function evmBlockToJsonRpcBlock(
  block: Block,
  includeTxData: boolean,
  chainId: bigint,
) {
  return {
    difficulty: bigIntToHex(block.header.difficulty),
    extraData: bytesToHex(block.header.extraData),
    gasLimit: bigIntToHex(block.header.gasLimit),
    gasUsed: bigIntToHex(block.header.gasUsed),
    hash: bytesToHex(block.hash()),
    logsBloom: bytesToHex(block.header.logsBloom),
    miner: block.header.coinbase.toString(),
    mixHash: bytesToHex(block.header.mixHash),
    nonce: bytesToHex(block.header.nonce),
    number: bigIntToHex(block.header.number),
    parentHash: bytesToHex(block.header.parentHash),
    receiptsRoot: bytesToHex(block.header.receiptTrie),
    sha3Uncles: bytesToHex(block.header.uncleHash),
    size: bigIntToHex(BigInt(block.serialize().length)),
    stateRoot: bytesToHex(block.header.stateRoot),
    timestamp: bigIntToHex(block.header.timestamp),
    totalDifficulty: bigIntToHex(block.header.difficulty),
    transactions: block.transactions.map((tx, i) =>
      includeTxData
        ? evmTransactionToJsonRpcTransaction(block, tx, i, chainId)
        : tx.hash,
    ),
    transactionsRoot: bytesToHex(block.header.transactionsTrie),
    uncles: block.uncleHeaders.map((u) => u.hash()),
  }
}

function evmTransactionToJsonRpcTransaction(
  block: Block | undefined,
  tx: TypedTransaction,
  i: number,
  chainId: bigint,
) {
  return {
    ...tx.toJSON(),
    blockHash: block ? block.hash() : blocklessSimulationBlockHash,
    blockNumber: block ? block.header.number : blocklessSimulationBlockNumber,
    from: tx.getSenderAddress().toString(),
    gas: tx.gasLimit,
    gasLimit: undefined,
    hash: bytesToHex(tx.hash()),
    input: tx.data,
    data: undefined,
    transactionIndex: '0x' + i.toString(16),
    chainId: bigIntToHex(chainId),
  }
}

function callPayloadToTxRequest(call: CallPayload): {
  from: string
  to: string
  data: string
  value: string
} {
  return {
    from: call.from,
    to: call.to,
    data: call.input || '0x',
    value: call.value || '0x0',
  }
}
