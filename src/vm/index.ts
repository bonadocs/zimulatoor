import { EVM } from '@ethereumjs/evm'
import { RPCBlockChain, RPCStateManager } from '@ethereumjs/statemanager'
import { Address } from '@ethereumjs/util'
import { VM } from '@ethereumjs/vm'
import { getBytes, hexlify, JsonRpcProvider, ZeroHash } from 'ethers'

type CreateVMOptions = {
  provider: JsonRpcProvider
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
    if (account && hexlify(account.codeHash) === ZeroHash) {
      account.codeHash = getBytes(KECCAK256_NULL)
      this._accountCache?.put(address, account)
      return account
    }
    return account
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
  const providerUrl = options.provider._getConnection().url
  const blockchain = new RPCBlockChain(providerUrl)

  const stateManager = new OverriddenStateManager({
    provider: providerUrl,
    blockTag: options.blockNumber,
  })
  const evm = new EVM({ blockchain, stateManager })
  return VM.create({
    evm,
    stateManager,
  })
}
