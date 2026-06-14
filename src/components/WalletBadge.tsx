'use client'

import { useEffect, useState, useCallback } from 'react'
import { Wallet, RefreshCw } from 'lucide-react'

type WalletState = {
  address: string
  balance_gen: string
  ok: boolean
  loading: boolean
  error: string | null
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function WalletBadge() {
  const [state, setState] = useState<WalletState>({
    address: '',
    balance_gen: '',
    ok: false,
    loading: true,
    error: null,
  })

  const fetchBalance = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/wallet/balance')
      const json = await res.json()
      setState({
        address: json.address ?? '',
        balance_gen: json.balance_gen ?? '0',
        ok: json.ok ?? false,
        loading: false,
        error: json.error ?? null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Fetch failed',
      }))
    }
  }, [])

  // Fetch on mount, then refresh every 60 seconds
  useEffect(() => {
    void fetchBalance()
    const id = setInterval(() => void fetchBalance(), 60_000)
    return () => clearInterval(id)
  }, [fetchBalance])

  if (state.loading && !state.address) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-400">
        <RefreshCw size={11} className="animate-spin" />
        <span>Loading wallet</span>
      </div>
    )
  }

  if (!state.ok || state.error) {
    return null
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs group cursor-default"
      title={`App wallet: ${state.address}`}
    >
      {/* Icon */}
      <Wallet size={12} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />

      {/* Address */}
      <span className="font-mono text-slate-500 dark:text-slate-400 tracking-tight">
        {truncateAddress(state.address)}
      </span>

      {/* Separator */}
      <span className="text-slate-300 dark:text-slate-600">·</span>

      {/* GEN balance */}
      <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
        {parseFloat(state.balance_gen).toFixed(2)}
        <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">GEN</span>
      </span>

      {/* Refresh button — visible on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); void fetchBalance() }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
        aria-label="Refresh balance"
        type="button"
      >
        <RefreshCw
          size={10}
          className={`text-slate-400 ${state.loading ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  )
}
