'use client'

import { useWallet } from '@/hooks/useWallet'
import { Wallet, Loader2, AlertCircle, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react'

export function WalletConnect() {
  const {
    connected,
    address,
    balanceGen,
    onCorrectChain,
    connecting,
    error,
    hasMetaMask,
    connect,
    switchToStudionet,
    refreshBalance,
  } = useWallet()

  // ── No MetaMask ──────────────────────────────────────────────────────────
  if (!hasMetaMask) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
      >
        <AlertCircle size={12} />
        Install MetaMask
        <ExternalLink size={10} />
      </a>
    )
  }

  // ── Connected + correct chain ─────────────────────────────────────────────
  if (connected && onCorrectChain && address) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs group cursor-default"
          title={`Connected: ${address}`}
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          <Wallet size={11} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="font-mono text-slate-500 dark:text-slate-400 tracking-tight">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
            {balanceGen !== null ? `${parseFloat(balanceGen).toFixed(2)} GEN` : '…'}
          </span>
          <button
            onClick={refreshBalance}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Refresh balance"
            type="button"
          >
            <RefreshCw size={10} className="text-slate-400" />
          </button>
        </div>

        <span className="text-[10px] text-emerald-600 font-medium hidden sm:inline">
          Studionet
        </span>
      </div>
    )
  }

  // ── Connected but wrong chain ─────────────────────────────────────────────
  if (connected && !onCorrectChain && address) {
    return (
      <button
        onClick={() => void switchToStudionet()}
        disabled={connecting}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium transition-colors disabled:opacity-60"
      >
        {connecting ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <AlertCircle size={11} />
        )}
        Switch to Studionet
      </button>
    )
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void connect()}
        disabled={connecting}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 shadow-sm"
      >
        {connecting ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <Wallet size={11} />
        )}
        {connecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && (
        <span className="text-[10px] text-red-500 max-w-[200px] text-right leading-tight">
          {error}
        </span>
      )}
    </div>
  )
}

// ── Inline gate shown inside panels when wallet not connected ─────────────────
export function WalletGate({ children, action }: { children: React.ReactNode; action: string }) {
  const { connected, onCorrectChain, hasMetaMask, connect, switchToStudionet, connecting, address } = useWallet()

  if (!hasMetaMask) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Wallet size={28} className="text-slate-300" />
        <p className="text-sm text-slate-500">MetaMask required to {action}</p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Install MetaMask <ExternalLink size={13} />
        </a>
      </div>
    )
  }

  if (!connected || !address) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Wallet size={28} className="text-blue-400" />
        <div>
          <p className="text-sm font-medium text-slate-700">Connect your wallet to {action}</p>
          <p className="text-xs text-slate-400 mt-1">
            You will sign a real GenLayer studionet transaction
          </p>
        </div>
        <button
          onClick={() => void connect()}
          disabled={connecting}
          className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  if (!onCorrectChain) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle size={28} className="text-amber-400" />
        <div>
          <p className="text-sm font-medium text-slate-700">Switch to GenLayer Studionet</p>
          <p className="text-xs text-slate-400 mt-1">Your wallet is on the wrong network</p>
        </div>
        <button
          onClick={() => void switchToStudionet()}
          disabled={connecting}
          className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {connecting ? 'Switching…' : 'Switch Network'}
        </button>
      </div>
    )
  }

  return <>{children}</>
}
