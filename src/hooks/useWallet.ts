'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy, useWallets, useLogout } from '@privy-io/react-auth'
import { createClient, chains } from 'genlayer-js'
import { setActiveProvider } from '@/lib/privy/provider-store'

const STUDIONET_CHAIN_ID_HEX = '0xf22f'

const STUDIONET_CONFIG = {
  chainId: '0xF22F',
  chainName: 'GenLayer Studio',
  nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: ['https://studio.genlayer.com'],
}

export type WalletState = {
  connected: boolean
  address: string | null
  balanceGen: string | null
  chainId: string | null
  onCorrectChain: boolean
  connecting: boolean
  error: string | null
}

async function fetchGenBalance(address: string): Promise<string | null> {
  try {
    const resp = await fetch('https://studio.genlayer.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    })
    const data = await resp.json() as { result?: string }
    if (data.result) {
      return (Number(BigInt(data.result)) / 1e18).toFixed(4)
    }
  } catch { /* ignore */ }
  return null
}

export function useWallet() {
  const { login, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { logout } = useLogout()

  const [switching, setSwitching] = useState(false)
  const [balanceGen, setBalanceGen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const wallet = wallets[0] ?? null
  const address = wallet?.address ?? null

  // Privy chainId format: "eip155:61999" — normalise to hex
  const rawChainId = wallet?.chainId ?? null
  const chainIdHex = rawChainId
    ? '0x' + parseInt(rawChainId.split(':').pop() ?? rawChainId, 10).toString(16)
    : null
  const onCorrectChain = chainIdHex === STUDIONET_CHAIN_ID_HEX
  const connected = !!(authenticated && address)

  // Keep provider store in sync whenever wallet changes
  useEffect(() => {
    if (!wallet) { setActiveProvider(null); return }
    void wallet.getEthereumProvider()
      .then((p) => setActiveProvider(p))
      .catch(() => setActiveProvider(null))
  }, [wallet])

  // Fetch GEN balance when address changes
  useEffect(() => {
    if (address) {
      void fetchGenBalance(address).then(setBalanceGen)
    } else {
      setBalanceGen(null)
    }
  }, [address])

  // ── connect — opens Privy modal (synchronous) ─────────────────────────────
  const connect = useCallback(() => {
    setError(null)
    login()
  }, [login])

  // ── switch to studionet ───────────────────────────────────────────────────
  const switchToStudionet = useCallback(async () => {
    if (!wallet) return
    setError(null)
    setSwitching(true)
    try {
      const provider = await wallet.getEthereumProvider()
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: STUDIONET_CONFIG.chainId }],
        })
      } catch (switchErr: unknown) {
        const code = (switchErr as { code?: number }).code
        if (code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [STUDIONET_CONFIG],
          })
        } else {
          throw switchErr
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed')
    } finally {
      setSwitching(false)
    }
  }, [wallet])

  // ── disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    setActiveProvider(null)
    await logout()
  }, [logout])

  // ── refresh balance ───────────────────────────────────────────────────────
  const refreshBalance = useCallback(() => {
    if (address) void fetchGenBalance(address).then(setBalanceGen)
  }, [address])

  // ── genlayer client ───────────────────────────────────────────────────────
  const getClient = useCallback(() => {
    if (!address || !wallet) return null
    return createClient({
      chain: chains.studionet,
      account: address as `0x${string}`,
      provider: {
        request: async (args: { method: string; params?: unknown[] }) => {
          const p = await wallet.getEthereumProvider()
          return p.request(args)
        },
      },
    })
  }, [address, wallet])

  return {
    connected,
    address,
    balanceGen,
    chainId: chainIdHex,
    onCorrectChain,
    connecting: switching,  // only true during chain switch, never during modal open
    error,
    hasMetaMask: typeof window !== 'undefined' && Boolean(window.ethereum),
    connect,
    switchToStudionet,
    disconnect,
    getClient,
    refreshBalance,
  }
}
