'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { ThemeProvider } from 'next-themes'
import { studionet } from '@/lib/privy/studionet-chain'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#3b82f6',
        },
        defaultChain: studionet,
        supportedChains: [studionet],
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
        },
      }}
    >
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
      </ThemeProvider>
    </PrivyProvider>
  )
}
