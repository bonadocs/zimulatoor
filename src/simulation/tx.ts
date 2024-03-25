import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx'
import { Address } from '@ethereumjs/util'
import { VM } from '@ethereumjs/vm'
import {
  copyRequest,
  isAddress,
  JsonRpcProvider,
  TransactionRequest,
  Wallet,
} from 'ethers'

import { initializeSimulationTransaction } from '../tx'

import { SimulationError } from './error'

export type PopulateTransactionOptions = {
  vm: VM
  provider: JsonRpcProvider
  tx: TransactionRequest
}

async function getAccountNonce(vm: VM, address: string) {
  const account = await vm.stateManager.getAccount(Address.fromString(address))
  return Number(account?.nonce ?? BigInt(0))
}

async function estimateGas(vm: VM, tx: TransactionRequest) {
  try {
    await vm.stateManager.checkpoint()
    const result = await vm.runTx({
      tx: initializeSimulationTransaction(FeeMarketEIP1559Transaction, {
        from: tx.from as string,
        to: tx.to as string,
        data: tx.data as string,
        gasLimit: 10_000_000,
        maxFeePerGas: 10,
      }),
      skipBalance: true,
      skipNonce: true,
      skipBlockGasLimitValidation: true,
      skipHardForkValidation: true,
    })
    return `0x${result.totalGasSpent.toString(16)}`
  } finally {
    await vm.stateManager.revert()
  }
}

export async function populateTransaction({
  vm,
  provider,
  tx,
}: PopulateTransactionOptions) {
  tx = copyRequest(tx)
  if (!isAddress(tx.from)) {
    throw new SimulationError('Invalid from address')
  }

  const from = tx.from
  tx.nonce = await getAccountNonce(vm, from)

  // cache gas limit to bypass the check
  const gasLimit = tx.gasLimit
  tx.gasLimit = 1

  // Hack from address to populate the transaction
  const dummyWalletForPopulate = new Wallet(
    '0x0101010101010101010101010101010101010101010101010101010101010101',
    provider,
  )
  tx.from = dummyWalletForPopulate.address
  const rpcTx = provider.getRpcTransaction(
    await dummyWalletForPopulate.populateTransaction(tx),
  )
  rpcTx.from = tx.from = from

  rpcTx.gas = gasLimit?.toString()

  // estimate gas if not provided. skip if it's a contract creation
  if (rpcTx.gas == null && rpcTx.to) {
    rpcTx.gas = await estimateGas(vm, tx)
  } else if (!rpcTx.to) {
    rpcTx.gas = '0x' + (10_000_000).toString(16)
  }
  return rpcTx
}
