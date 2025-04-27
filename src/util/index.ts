import { ExecResult } from '@ethereumjs/evm'
import { AbiCoder, getBytes, hexlify } from 'ethers'

import { EnhancedEvmError } from '../simulation/types'
import { getZimulatoorTagCache } from '../storage'

// this is mostly copied from ethers.js
// <<==============================>>

const PanicReasons: Map<number, string> = new Map()
PanicReasons.set(0x00, 'GENERIC_PANIC')
PanicReasons.set(0x01, 'ASSERT_FALSE')
PanicReasons.set(0x11, 'OVERFLOW')
PanicReasons.set(0x12, 'DIVIDE_BY_ZERO')
PanicReasons.set(0x21, 'ENUM_RANGE_ERROR')
PanicReasons.set(0x22, 'BAD_STORAGE_DATA')
PanicReasons.set(0x31, 'STACK_UNDERFLOW')
PanicReasons.set(0x32, 'ARRAY_RANGE_ERROR')
PanicReasons.set(0x41, 'OUT_OF_MEMORY')
PanicReasons.set(0x51, 'UNINITIALIZED_FUNCTION_CALL')

export function addErrorMessage(result: ExecResult) {
  if (!result.exceptionError) {
    return
  }

  const exceptionError = result.exceptionError as EnhancedEvmError

  const data = result.returnValue
  let message = 'missing revert data'
  const abiCoder = AbiCoder.defaultAbiCoder()

  let reason: null | string = null

  if (data) {
    message = 'execution reverted'

    const bytes = getBytes(data)

    if (bytes.length === 0) {
      message += ' (no data present; likely require(false) occurred'
      reason = 'require(false)'
    } else if (bytes.length % 32 !== 4) {
      message += ' (could not decode reason; invalid data length)'
    } else if (hexlify(bytes.slice(0, 4)) === '0x08c379a0') {
      // Error(string)
      try {
        reason = abiCoder.decode(['string'], bytes.slice(4))[0]
        message += `: ${JSON.stringify(reason)}`
      } catch (error) {
        message += ' (could not decode reason; invalid string data)'
      }
    } else if (hexlify(bytes.slice(0, 4)) === '0x4e487b71') {
      // Panic(uint256)
      try {
        const code = Number(abiCoder.decode(['uint256'], bytes.slice(4))[0])
        reason = `Panic due to ${PanicReasons.get(code) || 'UNKNOWN'}(${code})`
        message += `: ${reason}`
      } catch (error) {
        message += ' (could not decode panic code)'
      }
    } else {
      message += ' (unknown custom error)'
    }
  }

  exceptionError.message = message
  exceptionError.data = data
  return exceptionError
}

export async function getCachedBlockNumber(
  chainId: bigint,
): Promise<bigint | 'latest'> {
  const key = getCacheKey(chainId)
  const storage = await getZimulatoorTagCache()

  try {
    const data = await storage.getString(key)
    if (!data) {
      return 'latest'
    }

    const cachedBlockTag = JSON.parse(data)
    if (cachedBlockTag.expireAt && cachedBlockTag.expireAt < Date.now()) {
      return 'latest'
    }

    if (cachedBlockTag.blockTag) {
      return BigInt(cachedBlockTag.blockTag)
    }

    return 'latest'
  } catch (e) {
    return 'latest'
  }
}

export async function cacheBlockNumber(
  chainId: bigint,
  blockTag: bigint,
  expireAt?: number,
) {
  const key = getCacheKey(chainId)
  const storage = await getZimulatoorTagCache()

  let cachedTag = JSON.parse((await storage.getString(key)) || '{}')
  if (!cachedTag) {
    cachedTag = {}
  }

  cachedTag.blockTag = blockTag.toString()
  if (expireAt) {
    cachedTag.expireAt = expireAt
  } else {
    delete cachedTag.expireAt
  }

  await storage.set(key, JSON.stringify(cachedTag))
}

export async function deleteCachedBlockNumber(chainId: bigint): Promise<void> {
  const key = getCacheKey(chainId)
  const storage = await getZimulatoorTagCache()
  await storage.remove(key)
}

function getCacheKey(chainId: bigint) {
  return `block-tag-${chainId}`
}
