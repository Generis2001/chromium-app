import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const upstream = await fetch('https://studio.genlayer.com/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
