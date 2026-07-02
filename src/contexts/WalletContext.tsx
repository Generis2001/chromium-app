'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useWallet, type WalletState } from '@/hooks/useWallet'

type WalletContextValue = WalletState & {
  hasMetaMask: boolean
  connect: () => Promise<void>
  switchToStudionet: () => Promise<void>
  disconnect: () => Promise<void>
  getClient: () => ReturnType<typeof import('@/hooks/useWallet').useWallet>['getClient'] extends () => infer R ? R : never
  refreshBalance: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  return (
    <WalletContext.Provider value={wallet as unknown as WalletContextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWalletContext() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWalletContext must be used inside WalletProvider')
  return ctx
}
