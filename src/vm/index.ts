import { EVM } from '@ethereumjs/evm'
import { RPCBlockChain, RPCStateManager } from '@ethereumjs/statemanager'
import {
  Account,
  Address,
  bytesToHex,
  fetchFromProvider,
  toBytes,
} from '@ethereumjs/util'
import { VM } from '@ethereumjs/vm'
import { keccak256, ZeroHash } from 'ethers'

type CreateVMOptions = {
  providerUrl: string
  blockNumber: bigint
}

/**
 * Keccak-256 hash of null
 */
const KECCAK256_NULL =
  '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'

class OverriddenStateManager extends RPCStateManager {
  #deployedContracts: Map<string, Uint8Array> = new Map()

  async getAccount(address: Address) {
    const account = await super.getAccount(address)
    if (account && bytesToHex(account.codeHash) === ZeroHash) {
      account.codeHash = toBytes(KECCAK256_NULL)
      this._accountCache?.put(address, account)
      return account
    }
    return account
  }

  async getAccountFromProvider(address: Address): Promise<Account> {
    try {
      return await super.getAccountFromProvider(address)
    } catch {
      // provider does not support eth_getProof. Let's get the account data individually
      // this won't work for contract accounts because we can't get the storage root
      const [balance, nonce, code] = await Promise.all([
        fetchFromProvider(this._provider, {
          method: 'eth_getBalance',
          params: [address.toString(), this._blockTag],
        }),
        fetchFromProvider(this._provider, {
          method: 'eth_getTransactionCount',
          params: [address.toString(), this._blockTag],
        }),
        fetchFromProvider(this._provider, {
          method: 'eth_getCode',
          params: [address.toString(), 'latest'], // code doesn't change so we can use latest
        }),
      ])
      const codeHash = keccak256(code)
      return Account.fromAccountData({
        balance: BigInt(balance),
        nonce: BigInt(nonce),
        codeHash: toBytes(codeHash),
        storageRoot: toBytes(KECCAK256_NULL),
      })
    }
  }

  async putContractCode(address: Address, value: Uint8Array): Promise<void> {
    await super.putContractCode(address, value)
    this.#deployedContracts.set(address.toString(), value)
  }

  async revert(): Promise<void> {
    await super.revert()
    for (const [address, value] of this.#deployedContracts.entries()) {
      await super.putContractCode(Address.fromString(address), value!)
    }
  }
}

export async function createVM(options: CreateVMOptions): Promise<VM> {
  const blockchain = new RPCBlockChain(options.providerUrl)

  const stateManager = new OverriddenStateManager({
    provider: options.providerUrl,
    blockTag: options.blockNumber,
  })
  const evm = new EVM({ blockchain, stateManager })
  return VM.create({
    evm,
    stateManager,
  })
}
