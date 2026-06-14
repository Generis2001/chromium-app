import { NextResponse } from 'next/server'
import { createClient, createAccount, chains } from 'genlayer-js'

const { studionet } = chains

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type WalletBalanceResponse = {
  ok: boolean
  address: string
  balance_gen: string
  balance_wei: string
  network: string
  error?: string
}

export async function GET(): Promise<NextResponse<WalletBalanceResponse>> {
  const privateKey = process.env.GENLAYER_PRIVATE_KEY as `0x${string}` | undefined

  if (!privateKey) {
    return NextResponse.json({
      ok: false,
      address: '0x0000000000000000000000000000000000000000',
      balance_gen: '0',
      balance_wei: '0',
      network: 'studionet',
      error: 'GENLAYER_PRIVATE_KEY not configured',
    })
  }

  try {
    const account = createAccount(privateKey)
    const client = createClient({ chain: studionet, account })

    const balanceWei = await client.getBalance({ address: account.address })
    const balanceGen = (Number(balanceWei) / 1e18).toFixed(4)

    return NextResponse.json({
      ok: true,
      address: account.address,
      balance_gen: balanceGen,
      balance_wei: balanceWei.toString(),
      network: 'studionet',
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      address: '0x0000000000000000000000000000000000000000',
      balance_gen: '0',
      balance_wei: '0',
      network: 'studionet',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
