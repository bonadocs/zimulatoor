// bytecode for ERC20 contract with balanceOf at position 0 which mints 1M tokens to the deployer
// (no decimals function, but we assume it's 18)

import {
  concat,
  Contract,
  formatUnits,
  hexlify,
  JsonRpcProvider,
  parseUnits,
  randomBytes,
  Signer,
  toBeHex,
  toBigInt,
  zeroPadValue,
} from 'ethers'

import { SimulationProvider } from '../ethers'
import { getMappedUrl, iterateNetworks } from '../networks'
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

export async function testNetworkWithEthersProvider(
  provider: SimulationProvider,
  sender: string,
  tokenAddress: string,
) {
  const receiver = hexlify(randomBytes(20))

  const senderSigner = (await provider.getImpersonatedSigner(sender)) as Signer
  const receiverSigner = (await provider.getImpersonatedSigner(
    receiver,
  )) as Signer

  const erc20TransferAbi = [
    'function transfer(address to, uint256 amount)',
    'function balanceOf(address account) view returns (uint256)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]
  const contract = new Contract(tokenAddress, erc20TransferAbi, senderSigner)
  const receiverContract = new Contract(
    tokenAddress,
    erc20TransferAbi,
    receiverSigner,
  )

  const senderBalance = await contract.balanceOf(sender)
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
  const tx = await contract.transfer(receiver, amount)
  await tx.wait()

  // check sender balance
  const balanceAfterTransfer = await contract.balanceOf(sender)
  console.log({ balanceAfterTransfer })

  const receiverAmount = amount / 2n

  // send back 250k tokens to deployer
  const returnTx = await receiverContract.transfer(sender, receiverAmount)
  await returnTx.wait()

  // check sender balance
  const balanceAfterReturn = await receiverContract.balanceOf(receiver)
  console.log({ balanceAfterReturn })

  // compare both balances -> should add up to minted balance
  const deployerBalance = await contract.balanceOf(sender)
  const receiverBalance = await receiverContract.balanceOf(receiver)

  console.log({ deployerBalance, receiverBalance })
  if (deployerBalance + receiverBalance !== senderBalance) {
    throw new Error('Balances do not add up to minted balance')
  }
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

export async function main() {
  const invalidNetworks = []

  const ethereum = getMappedUrl(1)
  const provider = new SimulationProvider(new JsonRpcProvider(ethereum))
  const { address, token } = wealthyAddresses.get(1)!
  await testNetworkWithEthersProvider(provider, address, token)

  for (const { chainId: c } of iterateNetworks()) {
    const provider = new SimulationProvider(
      new JsonRpcProvider(getMappedUrl(c), undefined, {
        batchMaxCount: 1,
      }),
    )

    const network = await provider._detectNetwork()
    const chainId = Number(network.chainId)
    if (wealthyAddresses.has(chainId)) {
      const { token, address } = wealthyAddresses.get(chainId)!
      try {
        await testNetworkWithPublicToken(
          provider.backingProvider,
          token,
          address,
        )
      } catch (e) {
        console.error(e)
        invalidNetworks.push(c)
      }
    }

    try {
      await testNetworkSelfContained(provider.backingProvider)
    } catch (e) {
      console.error(e)
      invalidNetworks.push(c)
    }
  }

  console.log('Invalid networks:', invalidNetworks)
}

const bonadocs = {
  contracts: {
    cUSDCv3: {
      address: '0xc3d688b66703497daa19211eedff47f25384cdc3',
      abi: [
        { type: 'error', name: 'Absurd', inputs: [] },
        { type: 'error', name: 'AlreadyInitialized', inputs: [] },
        { type: 'error', name: 'BadAsset', inputs: [] },
        { type: 'error', name: 'BadDecimals', inputs: [] },
        { type: 'error', name: 'BadDiscount', inputs: [] },
        { type: 'error', name: 'BadMinimum', inputs: [] },
        { type: 'error', name: 'BadPrice', inputs: [] },
        { type: 'error', name: 'BorrowCFTooLarge', inputs: [] },
        { type: 'error', name: 'BorrowTooSmall', inputs: [] },
        { type: 'error', name: 'InsufficientReserves', inputs: [] },
        { type: 'error', name: 'InvalidInt104', inputs: [] },
        { type: 'error', name: 'InvalidInt256', inputs: [] },
        { type: 'error', name: 'InvalidUInt104', inputs: [] },
        { type: 'error', name: 'InvalidUInt128', inputs: [] },
        { type: 'error', name: 'InvalidUInt64', inputs: [] },
        { type: 'error', name: 'LiquidateCFTooLarge', inputs: [] },
        { type: 'error', name: 'NegativeNumber', inputs: [] },
        { type: 'error', name: 'NoSelfTransfer', inputs: [] },
        { type: 'error', name: 'NotCollateralized', inputs: [] },
        { type: 'error', name: 'NotForSale', inputs: [] },
        { type: 'error', name: 'NotLiquidatable', inputs: [] },
        { type: 'error', name: 'Paused', inputs: [] },
        { type: 'error', name: 'SupplyCapExceeded', inputs: [] },
        { type: 'error', name: 'TimestampTooLarge', inputs: [] },
        { type: 'error', name: 'TooManyAssets', inputs: [] },
        { type: 'error', name: 'TooMuchSlippage', inputs: [] },
        { type: 'error', name: 'TransferInFailed', inputs: [] },
        { type: 'error', name: 'TransferOutFailed', inputs: [] },
        { type: 'error', name: 'Unauthorized', inputs: [] },
        {
          type: 'event',
          anonymous: false,
          name: 'AbsorbCollateral',
          inputs: [
            { type: 'address', name: 'absorber', indexed: true },
            { type: 'address', name: 'borrower', indexed: true },
            { type: 'address', name: 'asset', indexed: true },
            { type: 'uint256', name: 'collateralAbsorbed', indexed: false },
            { type: 'uint256', name: 'usdValue', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'AbsorbDebt',
          inputs: [
            { type: 'address', name: 'absorber', indexed: true },
            { type: 'address', name: 'borrower', indexed: true },
            { type: 'uint256', name: 'basePaidOut', indexed: false },
            { type: 'uint256', name: 'usdValue', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'AdminChanged',
          inputs: [
            { type: 'address', name: 'previousAdmin', indexed: false },
            { type: 'address', name: 'newAdmin', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'BeaconUpgraded',
          inputs: [{ type: 'address', name: 'beacon', indexed: true }],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'BuyCollateral',
          inputs: [
            { type: 'address', name: 'buyer', indexed: true },
            { type: 'address', name: 'asset', indexed: true },
            { type: 'uint256', name: 'baseAmount', indexed: false },
            { type: 'uint256', name: 'collateralAmount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'PauseAction',
          inputs: [
            { type: 'bool', name: 'supplyPaused', indexed: false },
            { type: 'bool', name: 'transferPaused', indexed: false },
            { type: 'bool', name: 'withdrawPaused', indexed: false },
            { type: 'bool', name: 'absorbPaused', indexed: false },
            { type: 'bool', name: 'buyPaused', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'Supply',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'dst', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'SupplyCollateral',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'dst', indexed: true },
            { type: 'address', name: 'asset', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'Transfer',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'TransferCollateral',
          inputs: [
            { type: 'address', name: 'from', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'address', name: 'asset', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'Upgraded',
          inputs: [{ type: 'address', name: 'implementation', indexed: true }],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'Withdraw',
          inputs: [
            { type: 'address', name: 'src', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'WithdrawCollateral',
          inputs: [
            { type: 'address', name: 'src', indexed: true },
            { type: 'address', name: 'to', indexed: true },
            { type: 'address', name: 'asset', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        {
          type: 'event',
          anonymous: false,
          name: 'WithdrawReserves',
          inputs: [
            { type: 'address', name: 'to', indexed: true },
            { type: 'uint256', name: 'amount', indexed: false },
          ],
        },
        { type: 'fallback', stateMutability: 'payable' },
        {
          type: 'function',
          name: 'absorb',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'absorber' },
            { type: 'address[]', name: 'accounts' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'accrueAccount',
          constant: false,
          payable: false,
          inputs: [{ type: 'address', name: 'account' }],
          outputs: [],
        },
        {
          type: 'function',
          name: 'admin',
          constant: false,
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: 'admin_' }],
        },
        {
          type: 'function',
          name: 'approveThis',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'manager' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'balanceOf',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'account' }],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'baseBorrowMin',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'baseMinForRewards',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'baseScale',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'baseToken',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: '' }],
        },
        {
          type: 'function',
          name: 'baseTokenPriceFeed',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: '' }],
        },
        {
          type: 'function',
          name: 'baseTrackingBorrowSpeed',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'baseTrackingSupplySpeed',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'borrowBalanceOf',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'account' }],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'borrowKink',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'borrowPerSecondInterestRateBase',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'borrowPerSecondInterestRateSlopeHigh',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'borrowPerSecondInterestRateSlopeLow',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'buyCollateral',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'minAmount' },
            { type: 'uint256', name: 'baseAmount' },
            { type: 'address', name: 'recipient' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'changeAdmin',
          constant: false,
          payable: false,
          inputs: [{ type: 'address', name: 'newAdmin' }],
          outputs: [],
        },
        {
          type: 'function',
          name: 'decimals',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint8', name: '' }],
        },
        {
          type: 'function',
          name: 'extensionDelegate',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: '' }],
        },
        {
          type: 'function',
          name: 'getAssetInfo',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'uint8', name: 'i' }],
          outputs: [
            {
              type: 'tuple',
              name: '',
              components: [
                { type: 'uint8', name: 'offset' },
                { type: 'address', name: 'asset' },
                { type: 'address', name: 'priceFeed' },
                { type: 'uint64', name: 'scale' },
                { type: 'uint64', name: 'borrowCollateralFactor' },
                { type: 'uint64', name: 'liquidateCollateralFactor' },
                { type: 'uint64', name: 'liquidationFactor' },
                { type: 'uint128', name: 'supplyCap' },
              ],
            },
          ],
        },
        {
          type: 'function',
          name: 'getAssetInfoByAddress',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'asset' }],
          outputs: [
            {
              type: 'tuple',
              name: '',
              components: [
                { type: 'uint8', name: 'offset' },
                { type: 'address', name: 'asset' },
                { type: 'address', name: 'priceFeed' },
                { type: 'uint64', name: 'scale' },
                { type: 'uint64', name: 'borrowCollateralFactor' },
                { type: 'uint64', name: 'liquidateCollateralFactor' },
                { type: 'uint64', name: 'liquidationFactor' },
                { type: 'uint128', name: 'supplyCap' },
              ],
            },
          ],
        },
        {
          type: 'function',
          name: 'getBorrowRate',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'uint256', name: 'utilization' }],
          outputs: [{ type: 'uint64', name: '' }],
        },
        {
          type: 'function',
          name: 'getCollateralReserves',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'asset' }],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'getPrice',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'priceFeed' }],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'getReserves',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'int256', name: '' }],
        },
        {
          type: 'function',
          name: 'getSupplyRate',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'uint256', name: 'utilization' }],
          outputs: [{ type: 'uint64', name: '' }],
        },
        {
          type: 'function',
          name: 'getUtilization',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'governor',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: '' }],
        },
        {
          type: 'function',
          name: 'hasPermission',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [
            { type: 'address', name: 'owner' },
            { type: 'address', name: 'manager' },
          ],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'implementation',
          constant: false,
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: 'implementation_' }],
        },
        {
          type: 'function',
          name: 'initializeStorage',
          constant: false,
          payable: false,
          inputs: [],
          outputs: [],
        },
        {
          type: 'function',
          name: 'isAbsorbPaused',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isAllowed',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [
            { type: 'address', name: '' },
            { type: 'address', name: '' },
          ],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isBorrowCollateralized',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'account' }],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isBuyPaused',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isLiquidatable',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: 'account' }],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isSupplyPaused',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isTransferPaused',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'isWithdrawPaused',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'liquidatorPoints',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: '' }],
          outputs: [
            { type: 'uint32', name: 'numAbsorbs' },
            { type: 'uint64', name: 'numAbsorbed' },
            { type: 'uint128', name: 'approxSpend' },
            { type: 'uint32', name: '_reserved' },
          ],
        },
        {
          type: 'function',
          name: 'numAssets',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint8', name: '' }],
        },
        {
          type: 'function',
          name: 'pause',
          constant: false,
          payable: false,
          inputs: [
            { type: 'bool', name: 'supplyPaused' },
            { type: 'bool', name: 'transferPaused' },
            { type: 'bool', name: 'withdrawPaused' },
            { type: 'bool', name: 'absorbPaused' },
            { type: 'bool', name: 'buyPaused' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'pauseGuardian',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'address', name: '' }],
        },
        {
          type: 'function',
          name: 'quoteCollateral',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'baseAmount' },
          ],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'storeFrontPriceFactor',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'supply',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'supplyFrom',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'from' },
            { type: 'address', name: 'dst' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'supplyKink',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'supplyPerSecondInterestRateBase',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'supplyPerSecondInterestRateSlopeHigh',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'supplyPerSecondInterestRateSlopeLow',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'supplyTo',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'dst' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'targetReserves',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'totalBorrow',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'totalSupply',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'totalsCollateral',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: '' }],
          outputs: [
            { type: 'uint128', name: 'totalSupplyAsset' },
            { type: 'uint128', name: '_reserved' },
          ],
        },
        {
          type: 'function',
          name: 'trackingIndexScale',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'transfer',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'dst' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'transferAsset',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'dst' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'transferAssetFrom',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'src' },
            { type: 'address', name: 'dst' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'transferFrom',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'src' },
            { type: 'address', name: 'dst' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [{ type: 'bool', name: '' }],
        },
        {
          type: 'function',
          name: 'upgradeTo',
          constant: false,
          payable: false,
          inputs: [{ type: 'address', name: 'newImplementation' }],
          outputs: [],
        },
        {
          type: 'function',
          name: 'upgradeToAndCall',
          constant: false,
          stateMutability: 'payable',
          payable: true,
          inputs: [
            { type: 'address', name: 'newImplementation' },
            { type: 'bytes', name: 'data' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'userBasic',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: '' }],
          outputs: [
            { type: 'int104', name: 'principal' },
            { type: 'uint64', name: 'baseTrackingIndex' },
            { type: 'uint64', name: 'baseTrackingAccrued' },
            { type: 'uint16', name: 'assetsIn' },
            { type: 'uint8', name: '_reserved' },
          ],
        },
        {
          type: 'function',
          name: 'userCollateral',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [
            { type: 'address', name: '' },
            { type: 'address', name: '' },
          ],
          outputs: [
            { type: 'uint128', name: 'balance' },
            { type: 'uint128', name: '_reserved' },
          ],
        },
        {
          type: 'function',
          name: 'userNonce',
          constant: true,
          stateMutability: 'view',
          payable: false,
          inputs: [{ type: 'address', name: '' }],
          outputs: [{ type: 'uint256', name: '' }],
        },
        {
          type: 'function',
          name: 'withdraw',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'withdrawFrom',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'src' },
            { type: 'address', name: 'to' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'withdrawReserves',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'to' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'withdrawTo',
          constant: false,
          payable: false,
          inputs: [
            { type: 'address', name: 'to' },
            { type: 'address', name: 'asset' },
            { type: 'uint256', name: 'amount' },
          ],
          outputs: [],
        },
        { type: 'receive', stateMutability: 'payable' },
      ],
    },
  },
  commonAbis: {
    erc20: [
      'function name() public view returns (string)',
      'function symbol() public view returns (string)',
      'function decimals() public view returns (uint8)',
      'function totalSupply() public view returns (uint256)',
      'function balanceOf(address _owner) public view returns (uint256 balance)',
      'function transfer(address _to, uint256 _value) public returns (bool success)',
      'function transferFrom(address _from, address _to, uint256 _value) public returns (bool success)',
      'function approve(address _spender, uint256 _value) public returns (bool success)',
      'function allowance(address _owner, address _spender) public view returns (uint256 remaining)',
      'event Transfer(address indexed _from, address indexed _to, uint256 _value)',
      'event Approval(address indexed _owner, address indexed _spender, uint256 _value)',
    ],
  },
}
export async function debug() {
  const { address: cometAddress, abi: cometAbi } = bonadocs.contracts.cUSDCv3
  const erc20Abi = bonadocs.commonAbis.erc20

  const chainId = 1 // ethereum chainID
  const provider = new SimulationProvider(chainId)
  const wealthyAddress = '0xF977814e90dA44bFA03b6295A0616a897441aceC'
  const wealthySigner = await provider.getImpersonatedSigner(wealthyAddress)

  const collateralAssetAddress = '0xc00e94cb662c3520282e6f5717214004a7f26888'
  const comet = new Contract(cometAddress, cometAbi, wealthySigner as Signer)
  const collateralAsset = new Contract(
    collateralAssetAddress,
    erc20Abi,
    wealthySigner as Signer,
  )

  const allowanceAmount = parseUnits('1000', 18) // Desired allowance amount to be approved

  // check spender USDT balance before Supply
  console.log(
    'token balance before',
    formatUnits(await collateralAsset.balanceOf(wealthyAddress), 18),
  )

  // Approve the USDT token contract for the cUSDCv3 contract BEFORE calling the `cUSDCv3` supply method
  await collateralAsset.approve(cometAddress, allowanceAmount)

  const allowance = await collateralAsset.allowance(
    wealthyAddress,
    cometAddress,
  )
  console.log('allowance', formatUnits(allowance, 18))

  // After approval you can now call the cUSDCv3` supply method
  const tx = await comet.supply(collateralAssetAddress, allowanceAmount)
  const rct = await tx.wait()

  const log = rct.logs.find((l: any) => l.fragment?.name === 'SupplyCollateral')
  console.log('emitted SupplyCollateral', {
    from: log.args.from,
    dst: log.args.dst,
    asset: log.args.asset,
    amount: formatUnits(log.args.amount, 18),
  })

  // check spender USDT balance after Supply
  console.log(
    'token balance after',
    formatUnits(await collateralAsset.balanceOf(wealthyAddress), 18),
  )
}

// main().catch((e) => console.error(e))
debug().catch((e) => console.error(e))
