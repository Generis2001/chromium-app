import type { Chain } from 'viem'

export const studionet: Chain = {
  id: 61999,
  name: 'GenLayer Studio',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://studio.genlayer.com/api'] },
  },
  blockExplorers: {
    default: { name: 'GenLayer Studio', url: 'https://studio.genlayer.com' },
  },
}
