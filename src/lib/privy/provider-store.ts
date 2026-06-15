// Module-level store so useClientContract can access the active EIP-1193 provider
// set by useWallet after Privy connects.
type EIP1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }

let _provider: EIP1193 | null = null

export function setActiveProvider(p: EIP1193 | null) {
  _provider = p
}

export function getActiveProvider(): EIP1193 | null {
  return _provider
}
