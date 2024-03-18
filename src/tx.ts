import { TxOptions } from '@ethereumjs/tx'
import { Address } from '@ethereumjs/util'

type WithFromAddress = {
  from: string
}

export function initializeSimulationTransaction<
  TxDataType,
  TransactionType extends object,
>(
  TransactionClass: new (
    txData: TxDataType,
    opts: TxOptions,
  ) => TransactionType,
  txData: TxDataType & WithFromAddress,
  opts: TxOptions = {},
): TransactionType {
  const tx = new TransactionClass(txData, { ...opts, freeze: false })
  return Object.freeze(
    proxyGetAddressFunction(tx, Address.fromString(txData.from)),
  )
}

function proxyGetAddressFunction<T extends object>(
  originalObject: T,
  customAddress: Address,
) {
  return new Proxy(originalObject, {
    get: function (target, prop, receiver) {
      if (prop === 'getSenderAddress') {
        return function () {
          return customAddress
        }
      } else {
        return Reflect.get(target, prop, receiver)
      }
    },
  })
}
