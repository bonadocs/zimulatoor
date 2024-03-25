import { EvmError, ExecResult } from '@ethereumjs/evm'
import { AbiCoder, getBytes, hexlify } from 'ethers'

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

  const exceptionError: EvmError & { message?: string } = result.exceptionError

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
  return exceptionError
}
