'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient, chains } from 'genlayer-js'

function extractMessage(err: unknown, fallback = 'Connection failed'): string {
  if (err instanceof Error) return err.message
  if (err && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}
const STUDIONET_CONFIG = {
  chainId: '0xF22F', // 61999 in hex
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

const STUDIONET_CHAIN_ID = '0xf22f' // 61999 lowercase hex

function normalizeChainId(id: string): string {
  return id.toLowerCase()
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    connected: false,
    address: null,
    balanceGen: null,
    chainId: null,
    onCorrectChain: false,
    connecting: false,
    error: null,
  })

  const hasMetaMask = typeof window !== 'undefined' && Boolean(window.ethereum)

  // ── fetch GEN balance ─────────────────────────────────────────────────────
  const fetchBalance = useCallback(async (address: string) => {
    try {
      const resp = await fetch('https://studio.genlayer.com/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      })
      const data = await resp.json() as { result?: string }
      if (data.result) {
        const gen = (Number(BigInt(data.result)) / 1e18).toFixed(4)
        setState((s) => ({ ...s, balanceGen: gen }))
      }
    } catch {
      // ignore
    }
  }, [])

  // ── sync chain state from MetaMask ────────────────────────────────────────
  const syncChain = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return
    try {
      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
      const onCorrect = normalizeChainId(chainId) === STUDIONET_CHAIN_ID
      setState((s) => ({ ...s, chainId, onCorrectChain: onCorrect }))
    } catch {
      // ignore
    }
  }, [])

  // ── check if already connected (on mount) ────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const checkConnected = async () => {
      try {
        const accounts = await window.ethereum!.request({ method: 'eth_accounts' }) as string[]
        if (accounts.length > 0) {
          const address = accounts[0]
          const chainId = await window.ethereum!.request({ method: 'eth_chainId' }) as string
          const onCorrectChain = normalizeChainId(chainId) === STUDIONET_CHAIN_ID
          setState((s) => ({ ...s, connected: true, address, chainId, onCorrectChain }))
          void fetchBalance(address)
        }
      } catch {
        // not connected
      }
    }

    void checkConnected()

    // Listen for account/chain changes
    const onAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
        setState({ connected: false, address: null, balanceGen: null, chainId: null, onCorrectChain: false, connecting: false, error: null })
      } else {
        setState((s) => ({ ...s, connected: true, address: accs[0] }))
        void fetchBalance(accs[0])
      }
    }
    const onChainChanged = (chainId: unknown) => {
      const id = chainId as string
      const onCorrect = normalizeChainId(id) === STUDIONET_CHAIN_ID
      setState((s) => ({ ...s, chainId: id, onCorrectChain: onCorrect }))
    }

    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum?.removeListener('chainChanged', onChainChanged)
    }
  }, [fetchBalance])

  // ── connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setState((s) => ({ ...s, error: 'MetaMask not found. Please install MetaMask.' }))
      return
    }

    setState((s) => ({ ...s, connecting: true, error: null }))

    try {
      // 1. Request accounts
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      const address = accounts[0]

      // 2. Try to switch to studionet; add it if not present
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: STUDIONET_CONFIG.chainId }],
        })
      } catch (switchErr: unknown) {
        // 4902 = chain not added
        const code = (switchErr as { code?: number }).code
        if (code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [STUDIONET_CONFIG],
          })
        } else {
          throw switchErr
        }
      }

      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
      const onCorrectChain = normalizeChainId(chainId) === STUDIONET_CHAIN_ID

      setState((s) => ({ ...s, connected: true, address, chainId, onCorrectChain, connecting: false, error: null }))
      void fetchBalance(address)
    } catch (err) {
      const msg = extractMessage(err)
      setState((s) => ({ ...s, connecting: false, error: msg }))
    }
  }, [fetchBalance])

  // ── switch to studionet (if already connected but on wrong chain) ─────────
  const switchToStudionet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return
    setState((s) => ({ ...s, connecting: true, error: null }))
    try {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: STUDIONET_CONFIG.chainId }],
        })
      } catch (switchErr: unknown) {
        const code = (switchErr as { code?: number }).code
        if (code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [STUDIONET_CONFIG],
          })
        } else {
          throw switchErr
        }
      }
      await syncChain()
      setState((s) => ({ ...s, connecting: false }))
    } catch (err) {
      setState((s) => ({ ...s, connecting: false, error: extractMessage(err, 'Switch failed') }))
    }
  }, [syncChain])

  // ── get genlayer client using window.ethereum as provider ─────────────────
  const getClient = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum || !state.address) return null
    return createClient({
      chain: chains.studionet,
      // Pass address string + provider — SDK routes eth_sendTransaction through window.ethereum
      account: state.address as `0x${string}`,
      provider: window.ethereum,
    })
  }, [state.address])

  const refreshBalance = useCallback(() => {
    if (state.address) void fetchBalance(state.address)
  }, [state.address, fetchBalance])

  const disconnect = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        })
      }
    } catch {
      // wallet_revokePermissions not supported in all versions — fall through
    }
    setState({ connected: false, address: null, balanceGen: null, chainId: null, onCorrectChain: false, connecting: false, error: null })
  }, [])

  return { ...state, hasMetaMask, connect, switchToStudionet, getClient, refreshBalance, disconnect }
}
