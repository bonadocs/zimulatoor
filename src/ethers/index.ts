import {
  isAddress,
  JsonRpcApiProvider,
  JsonRpcError,
  JsonRpcPayload,
  JsonRpcProvider,
  JsonRpcResult,
  JsonRpcSigner,
  SigningKey,
} from 'ethers'

import { executeJsonRpcFunction } from '../jsonrpcapi'
import { getMappedUrl } from '../networks'
import { SimulationEngine } from '../simulation'
import { getCachedBlockNumber } from '../util'

type PromiseOrValue<T> = Promise<T> | T

export class SimulationProvider extends JsonRpcApiProvider {
  readonly #provider: JsonRpcProvider
  readonly #blockTag: PromiseOrValue<'latest' | bigint>
  #engine?: SimulationEngine

  constructor(
    providerOrChainId: JsonRpcProvider | number,
    blockTag?: 'latest' | bigint,
  ) {
    super()
    let provider: JsonRpcProvider
    if (typeof providerOrChainId === 'number') {
      provider = new JsonRpcProvider(getMappedUrl(providerOrChainId))
    } else {
      provider = providerOrChainId
    }
    this.#provider = provider
    this.#blockTag =
      blockTag ??
      provider.getNetwork().then((n) => getCachedBlockNumber(n.chainId))
  }

  get backingProvider() {
    return this.#provider
  }

  /**
   * When a public key is provided, the provider can be used to sign
   * transactions that get executed in a block. This is useful for testing
   * contracts that require a signature from a specific address. On the other
   * hand, when an address is provided, the provider simulates the transactions
   * without signing them.
   *
   * @param publicKeyOrAddress
   */
  async getImpersonatedSigner(publicKeyOrAddress: string) {
    await this.ensureEngine()

    if (!isAddress(publicKeyOrAddress)) {
      const privateKey = this.#engine!.impersonateAccount(publicKeyOrAddress)
      return new SigningKey(privateKey)
    }

    return new JsonRpcSigner(this, publicKeyOrAddress)
  }

  async _start(): Promise<void> {
    await this.ensureEngine()
    return super._start()
  }

  async send(method: string, params: Array<unknown> | Record<string, unknown>) {
    // We do this here rather than the constructor so that we don't send any
    // requests to the network (i.e. eth_chainId) until we absolutely have to.
    await this._start()
    return await super.send(method, params)
  }

  async _send(
    payload: JsonRpcPayload | JsonRpcPayload[],
  ): Promise<Array<JsonRpcResult | JsonRpcError>> {
    if (!Array.isArray(payload)) {
      payload = [payload]
    }

    const results: Array<JsonRpcResult | JsonRpcError> = []
    for (const request of payload) {
      results.push(
        await executeJsonRpcFunction(this.#engine!, this.#provider, request),
      )
    }
    return results
  }

  private async ensureEngine() {
    if (!this.#engine) {
      const blockTag = await this.#blockTag
      const blockNumber = typeof blockTag === 'bigint' ? blockTag : undefined
      this.#engine = await SimulationEngine.create(this.#provider, blockNumber)
    }
  }
}
