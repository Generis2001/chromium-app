'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient, chains } from 'genlayer-js'

const STUDIONET_CHAIN_ID = '0xf22f' // 61999

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

  // ── on mount: check if already connected, listen for changes ─────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum) return

    const checkConnected = async () => {
      try {
        const accounts = await window.ethereum!.request({ method: 'eth_accounts' }) as string[]
        if (accounts.length > 0) {
          const address = accounts[0]
          const chainId = (await window.ethereum!.request({ method: 'eth_chainId' })) as string
          const onCorrectChain = chainId.toLowerCase() === STUDIONET_CHAIN_ID
          setState(s => ({ ...s, connected: true, address, chainId, onCorrectChain }))
          void fetchGenBalance(address).then(bal => setState(s => ({ ...s, balanceGen: bal })))
        }
      } catch { /* not connected */ }
    }

    void checkConnected()

    const onAccountsChanged = (accounts: unknown) => {
      const accs = accounts as string[]
      if (accs.length === 0) {
        setState({ connected: false, address: null, balanceGen: null, chainId: null, onCorrectChain: false, connecting: false, error: null })
      } else {
        setState(s => ({ ...s, connected: true, address: accs[0] }))
        void fetchGenBalance(accs[0]).then(bal => setState(s => ({ ...s, balanceGen: bal })))
      }
    }
    const onChainChanged = (chainId: unknown) => {
      const id = chainId as string
      setState(s => ({ ...s, chainId: id, onCorrectChain: id.toLowerCase() === STUDIONET_CHAIN_ID }))
    }

    window.ethereum.on('accountsChanged', onAccountsChanged)
    window.ethereum.on('chainChanged', onChainChanged)
    return () => {
      window.ethereum?.removeListener('accountsChanged', onAccountsChanged)
      window.ethereum?.removeListener('chainChanged', onChainChanged)
    }
  }, [])

  // ── connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setState(s => ({ ...s, error: 'MetaMask not found. Please install MetaMask.' }))
      return
    }
    setState(s => ({ ...s, connecting: true, error: null }))
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      const address = accounts[0]
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIONET_CONFIG.chainId }] })
      } catch (switchErr: unknown) {
        if ((switchErr as { code?: number }).code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [STUDIONET_CONFIG] })
        } else {
          throw switchErr
        }
      }
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string
      const onCorrectChain = chainId.toLowerCase() === STUDIONET_CHAIN_ID
      setState(s => ({ ...s, connected: true, address, chainId, onCorrectChain, connecting: false, error: null }))
      void fetchGenBalance(address).then(bal => setState(s => ({ ...s, balanceGen: bal })))
    } catch (err) {
      setState(s => ({ ...s, connecting: false, error: err instanceof Error ? err.message : 'Connection failed' }))
    }
  }, [])

  // ── switch to studionet ───────────────────────────────────────────────────
  const switchToStudionet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return
    setState(s => ({ ...s, connecting: true, error: null }))
    try {
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIONET_CONFIG.chainId }] })
      } catch (switchErr: unknown) {
        if ((switchErr as { code?: number }).code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [STUDIONET_CONFIG] })
        } else {
          throw switchErr
        }
      }
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string
      setState(s => ({ ...s, chainId, onCorrectChain: chainId.toLowerCase() === STUDIONET_CHAIN_ID, connecting: false }))
    } catch (err) {
      setState(s => ({ ...s, connecting: false, error: err instanceof Error ? err.message : 'Switch failed' }))
    }
  }, [])

  // ── disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        await window.ethereum.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] })
      }
    } catch { /* some wallets don't support revoke */ }
    setState({ connected: false, address: null, balanceGen: null, chainId: null, onCorrectChain: false, connecting: false, error: null })
  }, [])

  // ── genlayer client ───────────────────────────────────────────────────────
  const getClient = useCallback(() => {
    if (typeof window === 'undefined' || !window.ethereum || !state.address) return null
    return createClient({
      chain: chains.studionet,
      account: state.address as `0x${string}`,
      provider: window.ethereum,
    })
  }, [state.address])

  const refreshBalance = useCallback(() => {
    if (state.address) {
      void fetchGenBalance(state.address).then(bal => setState(s => ({ ...s, balanceGen: bal })))
    }
  }, [state.address])

  return {
    ...state,
    hasMetaMask,
    connect,
    switchToStudionet,
    disconnect,
    getClient,
    refreshBalance,
  }
}
