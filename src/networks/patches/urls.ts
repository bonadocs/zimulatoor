export const networks = new Map<number, string[]>(
  [
    {
      chainId: 1,
      urls: ['https://eth.llamarpc.com'],
    },
    {
      chainId: 42161,
      urls: [
        'https://rpc.ankr.com/arbitrum/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 421614,
      urls: [
        'https://rpc.ankr.com/arbitrum_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 42170,
      urls: [
        'https://rpc.ankr.com/arbitrumnova/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 43114,
      urls: [
        'https://rpc.ankr.com/avalanche/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 43113,
      urls: [
        'https://rpc.ankr.com/avalanche_fuji/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 8453,
      urls: [
        'https://rpc.ankr.com/base/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 84532,
      urls: [
        'https://rpc.ankr.com/base_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 80085,
      urls: [
        'https://rpc.ankr.com/berachain_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 81457,
      urls: [
        'https://rpc.ankr.com/blast/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 168587773,
      urls: [
        'https://rpc.ankr.com/blast_testnet_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 56,
      urls: [
        'https://rpc.ankr.com/bsc/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 97,
      urls: [
        'https://rpc.ankr.com/bsc_testnet_chapel/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 199,
      urls: [
        'https://rpc.ankr.com/bttc/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 42220,
      urls: [
        'https://rpc.ankr.com/celo/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 88888,
      urls: [
        'https://rpc.ankr.com/chiliz/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1116,
      urls: [
        'https://rpc.ankr.com/core/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 17000,
      urls: [
        'https://rpc.ankr.com/eth_holesky/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 11155111,
      urls: [
        'https://rpc.ankr.com/eth_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 250,
      urls: [
        'https://rpc.ankr.com/fantom/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 4002,
      urls: [
        'https://rpc.ankr.com/fantom_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 314,
      urls: [
        'https://rpc.ankr.com/filecoin/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 314159,
      urls: [
        'https://rpc.ankr.com/filecoin_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 14,
      urls: [
        'https://rpc.ankr.com/flare/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 100,
      urls: [
        'https://rpc.ankr.com/gnosis/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 10200,
      urls: [
        'https://rpc.ankr.com/gnosis_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1666600000,
      urls: [
        'https://rpc.ankr.com/harmony/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 7332,
      urls: [
        'https://rpc.ankr.com/horizen_eon/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1663,
      urls: [
        'https://rpc.ankr.com/horizen_gobi_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 4689,
      urls: [
        'https://rpc.ankr.com/iotex/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 4690,
      urls: [
        'https://rpc.ankr.com/iotex_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 2222,
      urls: [
        'https://rpc.ankr.com/kava_evm/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 7887,
      urls: [
        'https://rpc.ankr.com/kinto/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 8217,
      urls: [
        'https://rpc.ankr.com/klaytn/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1001,
      urls: [
        'https://rpc.ankr.com/klaytn_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 5000,
      urls: [
        'https://rpc.ankr.com/mantle/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 5003,
      urls: [
        'https://rpc.ankr.com/mantle_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1284,
      urls: [
        'https://rpc.ankr.com/moonbeam/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 71402,
      urls: [
        'https://rpc.ankr.com/nervos/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 195,
      urls: [
        'https://rpc.ankr.com/okx_x1_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 10,
      urls: [
        'https://rpc.ankr.com/optimism/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 11155420,
      urls: [
        'https://rpc.ankr.com/optimism_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 137,
      urls: [
        'https://rpc.ankr.com/polygon/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 80002,
      urls: [
        'https://rpc.ankr.com/polygon_amoy/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 80001,
      urls: [
        'https://rpc.ankr.com/polygon_mumbai/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1101,
      urls: [
        'https://rpc.ankr.com/polygon_zkevm/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1442,
      urls: [
        'https://rpc.ankr.com/polygon_zkevm_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 570,
      urls: [
        'https://rpc.ankr.com/rollux/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 57000,
      urls: [
        'https://rpc.ankr.com/rollux_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 534352,
      urls: [
        'https://rpc.ankr.com/scroll/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 534351,
      urls: [
        'https://rpc.ankr.com/scroll_sepolia_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 57,
      urls: [
        'https://rpc.ankr.com/syscoin/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 167008,
      urls: [
        'https://rpc.ankr.com/taiko_katla/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 1559,
      urls: [
        'https://rpc.ankr.com/tenet_evm/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 50,
      urls: [
        'https://rpc.ankr.com/xdc/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 51,
      urls: [
        'https://rpc.ankr.com/xdc_testnet/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 324,
      urls: [
        'https://rpc.ankr.com/zksync_era/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 300,
      urls: [
        'https://rpc.ankr.com/zksync_era_sepolia/829035857b52d5832a6312bcd3652d73cc0d698f6756ed66e2851c691d63e994',
      ],
    },
    {
      chainId: 59144,
      urls: [
        'https://linea-mainnet.infura.io/v3/1431d4934076411eaaa25d0f30a2612e',
      ],
    },
  ].map((n) => [n.chainId, n.urls]),
)
