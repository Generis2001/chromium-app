'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy, useWallets, useConnectWallet, useLogout } from '@privy-io/react-auth'
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
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { connectWallet } = useConnectWallet()
  const { logout } = useLogout()

  const [connecting, setConnecting] = useState(false)
  const [balanceGen, setBalanceGen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // First connected external wallet
  const wallet = wallets[0] ?? null
  const address = wallet?.address ?? null

  // Privy chainId format: "eip155:61999" — normalise to hex
  const rawChainId = wallet?.chainId ?? null
  const chainIdHex = rawChainId
    ? '0x' + parseInt(rawChainId.split(':').pop() ?? rawChainId, 10).toString(16)
    : null
  const onCorrectChain = chainIdHex === STUDIONET_CHAIN_ID_HEX

  const connected = !!(authenticated && address)

  // Stop connecting spinner as soon as wallet connects
  useEffect(() => {
    if (connected) setConnecting(false)
  }, [connected])

  // Keep provider store in sync
  useEffect(() => {
    if (!wallet) { setActiveProvider(null); return }
    void wallet.getEthereumProvider()
      .then((p) => setActiveProvider(p))
      .catch(() => setActiveProvider(null))
  }, [wallet])

  // Fetch balance when address changes
  useEffect(() => {
    if (address) {
      void fetchGenBalance(address).then(setBalanceGen)
    } else {
      setBalanceGen(null)
    }
  }, [address])

  // ── connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!ready) return
    setError(null)
    setConnecting(true)
    try {
      connectWallet()
      // Privy opens a modal — connecting resets via the useEffect above when wallet connects,
      // or after a timeout so the button doesn't stay locked if user closes the modal
      setTimeout(() => setConnecting(false), 60_000)
    } catch (err) {
      setConnecting(false)
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [ready, connectWallet])

  // ── switch to studionet ───────────────────────────────────────────────────
  const switchToStudionet = useCallback(async () => {
    if (!wallet) return
    setError(null)
    setConnecting(true)
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
      setConnecting(false)
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

  const hasMetaMask = typeof window !== 'undefined' && Boolean(window.ethereum)

  return {
    connected,
    address,
    balanceGen,
    chainId: chainIdHex,
    onCorrectChain,
    connecting,
    error,
    hasMetaMask,
    connect,
    switchToStudionet,
    disconnect,
    getClient,
    refreshBalance,
  }
}
