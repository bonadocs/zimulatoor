import { CustomCrypto } from '@ethereumjs/common'
import { Address, bytesToHex, ecrecover, hexToBytes } from '@ethereumjs/util'
import { Wallet } from 'ethers'

export class SignatureMatcher {
  #wallets: Map<string, Uint8Array>
  #reverseAddresses: Map<string, string>
  #addressPublicKeys: Map<string, Uint8Array>
  readonly customCrypto: CustomCrypto

  constructor() {
    this.#wallets = new Map()
    this.#reverseAddresses = new Map()
    this.#addressPublicKeys = new Map()
    this.customCrypto = {
      ecrecover: (msgHash, v, r, s) => {
        const publicKey = ecrecover(msgHash, v, r, s, BigInt(1))
        const address = Address.fromPublicKey(publicKey)
        const signerAddress = bytesToHex(address.bytes)
        const simulationAddress =
          this.getReverseSimulationAddress(signerAddress)

        if (!simulationAddress) {
          return publicKey
        }

        const simulationPublicKey =
          this.#addressPublicKeys.get(simulationAddress)

        if (!simulationPublicKey) {
          throw new Error(
            `Public key for address ${simulationAddress} not found`,
          )
        }

        return simulationPublicKey
      },
    }
  }

  /**
   * Generates a simulation wallet for the given address. The wallet can
   * be used to sign transactions. The EVM is modified to accept the
   * signature of the wallet in place of the actual private key of the original
   * address.
   * @param address
   */
  getSimulationPrivateKey(address: string) {
    if (!this.#addressPublicKeys.has(address)) {
      throw new Error(
        `Public key for address ${address} must be registered first`,
      )
    }

    let privateKey = this.#wallets.get(address)
    if (privateKey) {
      return privateKey
    }

    const wallet = Wallet.createRandom()
    privateKey = hexToBytes(wallet.privateKey)
    this.#wallets.set(address, privateKey)
    this.#reverseAddresses.set(wallet.address, address)
    return privateKey
  }

  isPublicKeyRegistered(address: string) {
    return this.#addressPublicKeys.has(address)
  }

  registerSimulationPublicKey(publicKey: Uint8Array) {
    const address = bytesToHex(Address.fromPublicKey(publicKey).bytes)
    this.#addressPublicKeys.set(address, publicKey)
  }

  getReverseSimulationAddress(signerAddress: string) {
    return this.#reverseAddresses.get(signerAddress)
  }
}
