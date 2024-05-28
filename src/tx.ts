import { TxOptions, TypedTransaction, TypedTxData } from '@ethereumjs/tx'
import { Address } from '@ethereumjs/util'

import { SignatureMatcher } from './simulation/signature-matcher'

type WithFromAddress = {
  from: string
}

export function initializeSimulationTransaction<
  TxDataType extends TypedTxData,
  TransactionType extends TypedTransaction,
>(
  TransactionClass: new (
    txData: TxDataType,
    opts: TxOptions,
  ) => TransactionType,
  txData: TxDataType & WithFromAddress,
  opts: TxOptions = {},
  signatureMatcher: SignatureMatcher,
): TransactionType {
  let tx = new TransactionClass(txData, { ...opts, freeze: false })
  if (
    txData.v === undefined &&
    txData.r === undefined &&
    txData.s === undefined
  ) {
    if (signatureMatcher.isPublicKeyRegistered(txData.from)) {
      const privateKey = signatureMatcher.getSimulationPrivateKey(txData.from)
      tx = tx.sign(privateKey) as typeof tx
    } else {
      tx = proxyGetAddressFunction(tx, Address.fromString(txData.from))
    }
  }
  return Object.freeze(tx)
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
