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
    { chainId: 42161, urls: ['https://rpc.ankr.com/arbitrum/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 42161, urls: ['https://rpc.ankr.com/arbitrum/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 42161, urls: ['https://rpc.ankr.com/arbitrum/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 421614, urls: ['https://rpc.ankr.com/arbitrum_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 42170, urls: ['https://rpc.ankr.com/arbitrumnova/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 43114, urls: ['https://rpc.ankr.com/avalanche/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 43113, urls: ['https://rpc.ankr.com/avalanche_fuji/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 8453, urls: ['https://rpc.ankr.com/base/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 84532, urls: ['https://rpc.ankr.com/base_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 80085, urls: ['https://rpc.ankr.com/berachain_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 81457, urls: ['https://rpc.ankr.com/blast/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    {
      chainId: 168587773,
      urls: ['https://rpc.ankr.com/blast_testnet_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'],
    },
    { chainId: 56, urls: ['https://rpc.ankr.com/bsc/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 97, urls: ['https://rpc.ankr.com/bsc_testnet_chapel/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 199, urls: ['https://rpc.ankr.com/bttc/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 42220, urls: ['https://rpc.ankr.com/celo/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 88888, urls: ['https://rpc.ankr.com/chiliz/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1116, urls: ['https://rpc.ankr.com/core/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1, urls: ['https://rpc.ankr.com/eth/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 17000, urls: ['https://rpc.ankr.com/eth_holesky/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 11155111, urls: ['https://rpc.ankr.com/eth_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 250, urls: ['https://rpc.ankr.com/fantom/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 4002, urls: ['https://rpc.ankr.com/fantom_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 314, urls: ['https://rpc.ankr.com/filecoin/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 314159, urls: ['https://rpc.ankr.com/filecoin_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 14, urls: ['https://rpc.ankr.com/flare/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 100, urls: ['https://rpc.ankr.com/gnosis/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 10200, urls: ['https://rpc.ankr.com/gnosis_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1666600000, urls: ['https://rpc.ankr.com/harmony/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 7332, urls: ['https://rpc.ankr.com/horizen_eon/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1663, urls: ['https://rpc.ankr.com/horizen_gobi_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 4689, urls: ['https://rpc.ankr.com/iotex/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 4690, urls: ['https://rpc.ankr.com/iotex_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 2222, urls: ['https://rpc.ankr.com/kava_evm/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 7887, urls: ['https://rpc.ankr.com/kinto/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 8217, urls: ['https://rpc.ankr.com/klaytn/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1001, urls: ['https://rpc.ankr.com/klaytn_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 5000, urls: ['https://rpc.ankr.com/mantle/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 5003, urls: ['https://rpc.ankr.com/mantle_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1284, urls: ['https://rpc.ankr.com/moonbeam/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 71402, urls: ['https://rpc.ankr.com/nervos/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 195, urls: ['https://rpc.ankr.com/okx_x1_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 10, urls: ['https://rpc.ankr.com/optimism/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 11155420, urls: ['https://rpc.ankr.com/optimism_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 137, urls: ['https://rpc.ankr.com/polygon/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 80002, urls: ['https://rpc.ankr.com/polygon_amoy/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 80001, urls: ['https://rpc.ankr.com/polygon_mumbai/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1101, urls: ['https://rpc.ankr.com/polygon_zkevm/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1442, urls: ['https://rpc.ankr.com/polygon_zkevm_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 570, urls: ['https://rpc.ankr.com/rollux/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 57000, urls: ['https://rpc.ankr.com/rollux_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 534352, urls: ['https://rpc.ankr.com/scroll/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 534351, urls: ['https://rpc.ankr.com/scroll_sepolia_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 57, urls: ['https://rpc.ankr.com/syscoin/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 167008, urls: ['https://rpc.ankr.com/taiko_katla/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 1559, urls: ['https://rpc.ankr.com/tenet_evm/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 50, urls: ['https://rpc.ankr.com/xdc/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 51, urls: ['https://rpc.ankr.com/xdc_testnet/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 324, urls: ['https://rpc.ankr.com/zksync_era/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    { chainId: 300, urls: ['https://rpc.ankr.com/zksync_era_sepolia/2d47556778fa48b20e04d625debf0e0697c4be973dbe56a16c4e0626b953d482'] },
    {
      chainId: 59144,
      urls: [
        'https://linea-mainnet.infura.io/v3/1431d4934076411eaaa25d0f30a2612e',
      ],
    },
  ].map((n) => [n.chainId, n.urls]),
)
