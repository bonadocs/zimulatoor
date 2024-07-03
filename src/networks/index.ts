let isFetchPatched = false

export function getMappedUrl(chainId: number) {
  const url = networks.get(chainId)?.[0]
  if (url) {
    return isFetchPatched
      ? `https://simulation-mapper-url?chainId=${chainId}`
      : url
  }

  throw new Error(`Network ${chainId} not currently supported for simulation`)
}

export function* iterateNetworks() {
  const iter = networks.entries()
  for (const [chainId, urls] of iter) {
    yield { chainId, urls }
  }
}

function isMappedUrl(url: string) {
  return url.startsWith('https://simulation-mapper-url')
}

function resolveMappedUrls(url: string) {
  if (!isMappedUrl(url)) {
    throw new Error(`URL ${url} is not a mapped URL`)
  }

  const chainId = Number(url.split('=')[1])
  const urls = networks.get(chainId)
  if (!urls) {
    throw new Error(`Network ${chainId} not currently supported for simulation`)
  }

  return urls
}

function patchFetch() {
  if (typeof self?.fetch === 'function') {
    const originalFetch = self.fetch

    self.fetch = async function fetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      let url: string
      if (typeof input === 'string') {
        url = input
      } else if (typeof input === 'object' && 'url' in input) {
        url = input.url
      } else {
        url = input.toString()
      }

      // not a mapped URL, proceed with original fetch
      if (!isMappedUrl(url)) {
        return originalFetch(input, init)
      }

      const urls = resolveMappedUrls(url)
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i]
        try {
          const response = await originalFetch(url, init)
          if (!response.ok) {
            continue
          }

          return response
        } catch (e) {
          if (i === urls.length - 1) {
            throw e
          }
        }
      }

      throw new Error('Failed to fetch any of the mapped URLs')
    }

    isFetchPatched = true
  }
}

patchFetch()

const networks = new Map<number, string[]>(
  [
    { chainId: 42161, urls: ['https://rpc.ankr.com/arbitrum'] },
    { chainId: 421614, urls: ['https://rpc.ankr.com/arbitrum_sepolia'] },
    { chainId: 42170, urls: ['https://rpc.ankr.com/arbitrumnova'] },
    { chainId: 43114, urls: ['https://rpc.ankr.com/avalanche'] },
    { chainId: 43113, urls: ['https://rpc.ankr.com/avalanche_fuji'] },
    { chainId: 8453, urls: ['https://rpc.ankr.com/base'] },
    { chainId: 84532, urls: ['https://rpc.ankr.com/base_sepolia'] },
    { chainId: 80085, urls: ['https://rpc.ankr.com/berachain_testnet'] },
    { chainId: 81457, urls: ['https://rpc.ankr.com/blast'] },
    {
      chainId: 168587773,
      urls: ['https://rpc.ankr.com/blast_testnet_sepolia'],
    },
    { chainId: 56, urls: ['https://rpc.ankr.com/bsc'] },
    { chainId: 97, urls: ['https://rpc.ankr.com/bsc_testnet_chapel'] },
    { chainId: 199, urls: ['https://rpc.ankr.com/bttc'] },
    { chainId: 42220, urls: ['https://rpc.ankr.com/celo'] },
    { chainId: 88888, urls: ['https://rpc.ankr.com/chiliz'] },
    { chainId: 1116, urls: ['https://rpc.ankr.com/core'] },
    { chainId: 1, urls: ['https://rpc.ankr.com/eth'] },
    { chainId: 17000, urls: ['https://rpc.ankr.com/eth_holesky'] },
    { chainId: 11155111, urls: ['https://rpc.ankr.com/eth_sepolia'] },
    { chainId: 250, urls: ['https://rpc.ankr.com/fantom'] },
    { chainId: 4002, urls: ['https://rpc.ankr.com/fantom_testnet'] },
    { chainId: 314, urls: ['https://rpc.ankr.com/filecoin'] },
    { chainId: 314159, urls: ['https://rpc.ankr.com/filecoin_testnet'] },
    { chainId: 14, urls: ['https://rpc.ankr.com/flare'] },
    { chainId: 100, urls: ['https://rpc.ankr.com/gnosis'] },
    { chainId: 10200, urls: ['https://rpc.ankr.com/gnosis_testnet'] },
    { chainId: 1666600000, urls: ['https://rpc.ankr.com/harmony'] },
    { chainId: 7332, urls: ['https://rpc.ankr.com/horizen_eon'] },
    { chainId: 1663, urls: ['https://rpc.ankr.com/horizen_gobi_testnet'] },
    { chainId: 4689, urls: ['https://rpc.ankr.com/iotex'] },
    { chainId: 4690, urls: ['https://rpc.ankr.com/iotex_testnet'] },
    { chainId: 2222, urls: ['https://rpc.ankr.com/kava_evm'] },
    { chainId: 7887, urls: ['https://rpc.ankr.com/kinto'] },
    { chainId: 8217, urls: ['https://rpc.ankr.com/klaytn'] },
    { chainId: 1001, urls: ['https://rpc.ankr.com/klaytn_testnet'] },
    { chainId: 5000, urls: ['https://rpc.ankr.com/mantle'] },
    { chainId: 5003, urls: ['https://rpc.ankr.com/mantle_sepolia'] },
    { chainId: 1284, urls: ['https://rpc.ankr.com/moonbeam'] },
    { chainId: 71402, urls: ['https://rpc.ankr.com/nervos'] },
    { chainId: 195, urls: ['https://rpc.ankr.com/okx_x1_testnet'] },
    { chainId: 10, urls: ['https://rpc.ankr.com/optimism'] },
    { chainId: 11155420, urls: ['https://rpc.ankr.com/optimism_sepolia'] },
    { chainId: 137, urls: ['https://rpc.ankr.com/polygon'] },
    { chainId: 80002, urls: ['https://rpc.ankr.com/polygon_amoy'] },
    { chainId: 80001, urls: ['https://rpc.ankr.com/polygon_mumbai'] },
    { chainId: 1101, urls: ['https://rpc.ankr.com/polygon_zkevm'] },
    { chainId: 1442, urls: ['https://rpc.ankr.com/polygon_zkevm_testnet'] },
    { chainId: 570, urls: ['https://rpc.ankr.com/rollux'] },
    { chainId: 57000, urls: ['https://rpc.ankr.com/rollux_testnet'] },
    { chainId: 534352, urls: ['https://rpc.ankr.com/scroll'] },
    { chainId: 534351, urls: ['https://rpc.ankr.com/scroll_sepolia_testnet'] },
    { chainId: 57, urls: ['https://rpc.ankr.com/syscoin'] },
    { chainId: 167008, urls: ['https://rpc.ankr.com/taiko_katla'] },
    { chainId: 1559, urls: ['https://rpc.ankr.com/tenet_evm'] },
    { chainId: 50, urls: ['https://rpc.ankr.com/xdc'] },
    { chainId: 51, urls: ['https://rpc.ankr.com/xdc_testnet'] },
    { chainId: 324, urls: ['https://rpc.ankr.com/zksync_era'] },
    { chainId: 300, urls: ['https://rpc.ankr.com/zksync_era_sepolia'] },
    {
      chainId: 59144,
      urls: [
        'https://linea-mainnet.infura.io/v3/1431d4934076411eaaa25d0f30a2612e',
      ],
    },
  ].map((n) => [n.chainId, n.urls]),
)
