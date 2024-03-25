// bytecode for ERC20 contract with balanceOf at position 0 which mints 1M tokens to the deployer
// (no decimals function, but we assume it's 18)

import {
  concat,
  hexlify,
  JsonRpcProvider,
  parseUnits,
  randomBytes,
  toBeHex,
  toBigInt,
  zeroPadValue,
} from 'ethers'

import { networks } from '../networks'
import { SimulationEngine } from '../simulation'

const bytecode =
  '0x608060405234801561001057600080fd5b503360008181526020818152604080832069d3c21bcecceda1000000908190559051818152909392917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a35061021e806100746000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806370a082311461003b578063a9059cbb1461006d575b600080fd5b61005b610049366004610176565b60006020819052908152604090205481565b60405190815260200160405180910390f35b61008061007b366004610198565b610082565b005b336000908152602081905260409020548111156100dc5760405162461bcd60e51b8152602060048201526014602482015273496e73756666696369656e742062616c616e636560601b604482015260640160405180910390fd5b33600090815260208190526040808220805484900390556001600160a01b0384168252812080548392906101119084906101c2565b90915550506040518181526001600160a01b0383169033907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9060200160405180910390a35050565b80356001600160a01b038116811461017157600080fd5b919050565b60006020828403121561018857600080fd5b6101918261015a565b9392505050565b600080604083850312156101ab57600080fd5b6101b48361015a565b946020939093013593505050565b600082198211156101e357634e487b7160e01b600052601160045260246000fd5b50019056fea26469706673582212204689bfaf36a88a136efcc5dd666289b46e25c11eeafa1831d3e6142fc8e4b8bf64736f6c634300080e0033'

const wealthyAddresses = new Map<
  number,
  {
    token: string
    address: string
  }
>([
  [
    1,
    {
      token: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      address: '0x3F8CFf57fb4592A0BA46c66D2239486b8690842E',
    },
  ],
])

async function getBalance(
  engine: SimulationEngine,
  tokenAddress: string,
  address: string,
) {
  const response = await engine.call({
    from: address,
    to: tokenAddress,
    data: concat(['0x70a08231', zeroPadValue(address, 32)]),
  })

  if (response.execResult.exceptionError) {
    const error = response.execResult.exceptionError

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(`Failed to get balance: ${(<any>error).message}`)
  }

  return toBigInt(response.execResult.returnValue)
}

async function testNetwork(
  engine: SimulationEngine,
  sender: string,
  tokenAddress: string,
) {
  const receiver = hexlify(randomBytes(20))

  const senderBalance = await getBalance(engine, tokenAddress, sender)
  console.log({ senderBalance })

  if (!senderBalance) {
    throw new Error('Minted balance is zero')
  }

  const decimals = 6
  // random amount between 100k and 1M tokens
  const amount = parseUnits(
    Math.floor(
      Math.random() * Number(senderBalance / BigInt(Math.pow(10, decimals))),
    ).toString(),
    decimals,
  )

  if (amount > senderBalance) {
    throw new Error('Amount is greater than minted balance')
  }

  // send {amount} tokens to receiver
  const initialTransferResult = await engine.execute({
    from: sender,
    to: tokenAddress,
    data: concat([
      '0xa9059cbb',
      zeroPadValue(receiver, 32),
      toBeHex(amount, 32),
    ]),
  })
  if (
    !('status' in initialTransferResult.receipt) ||
    !initialTransferResult.receipt.status
  ) {
    throw new Error(
      `Initial transfer failed => ${initialTransferResult.error?.error}: ${initialTransferResult.error?.message}`,
    )
  }

  // check sender balance
  const balanceAfterTransfer = await getBalance(engine, tokenAddress, sender)
  console.log({ balanceAfterTransfer })

  const receiverAmount = amount / 2n
  // send back 250k tokens to deployer
  const returnTransferResult = await engine.execute({
    from: receiver,
    to: tokenAddress,
    data: concat([
      '0xa9059cbb',
      zeroPadValue(sender, 32),
      toBeHex(receiverAmount, 32),
    ]),
  })

  if (
    !('status' in returnTransferResult.receipt) ||
    !returnTransferResult.receipt.status
  ) {
    throw new Error(
      `Return transfer failed => ${returnTransferResult.error?.error}: ${returnTransferResult.error?.message}`,
    )
  }

  // check sender balance
  const balanceAfterReturn = await getBalance(engine, tokenAddress, receiver)
  console.log({ balanceAfterReturn })

  // compare both balances -> should add up to minted balance
  const deployerBalance = await getBalance(engine, tokenAddress, sender)
  const receiverBalance = await getBalance(engine, tokenAddress, receiver)

  console.log({ deployerBalance, receiverBalance })
  if (deployerBalance + receiverBalance !== senderBalance) {
    throw new Error('Balances do not add up to minted balance')
  }
}

async function testNetworkSelfContained(provider: JsonRpcProvider) {
  const network = await provider._detectNetwork()
  console.log('Testing network (self-contained):', network.chainId)

  const deployer = hexlify(randomBytes(20))
  const engine = await SimulationEngine.create(provider)

  // deploy ERC20 contract
  const deploymentResult = await engine.execute({
    from: deployer,
    data: bytecode,
  })

  if (
    deploymentResult.execResult.exceptionError ||
    !deploymentResult.createdAddress
  ) {
    throw new Error(
      `Contract deployment failed: ${deploymentResult.error?.error}: ${deploymentResult.error?.message}`,
    )
  }

  const tokenAddress = deploymentResult.createdAddress.toString()
  await testNetwork(engine, deployer, tokenAddress)
  console.log('Done testing network:', network.chainId)
}

async function testNetworkWithPublicToken(
  provider: JsonRpcProvider,
  tokenAddress: string,
  wealthyAddress: string,
) {
  const network = await provider._detectNetwork()
  console.log('Testing network (public token):', network.chainId)

  const engine = await SimulationEngine.create(provider)
  await testNetwork(engine, wealthyAddress, tokenAddress)
  console.log('Done testing network:', network.chainId)
}

async function main() {
  const invalidNetworks = []
  for (const networkUrl of networks.map((n) => n.url)) {
    const provider = new JsonRpcProvider(networkUrl, undefined, {
      batchMaxCount: 1,
    })

    const network = await provider._detectNetwork()
    const chainId = Number(network.chainId)
    if (wealthyAddresses.has(chainId)) {
      const { token, address } = wealthyAddresses.get(chainId)!
      try {
        await testNetworkWithPublicToken(provider, token, address)
      } catch (e) {
        console.error(e)
        invalidNetworks.push(networkUrl)
      }
    }

    try {
      await testNetworkSelfContained(provider)
    } catch (e) {
      console.error(e)
      invalidNetworks.push(networkUrl)
    }
  }

  console.log('Invalid networks:', invalidNetworks)
}

main().catch((e) => console.error(e))
