'use client'

/**
 * useClientContract
 *
 * Client-side GenLayer contract invocation via window.ethereum.
 * The user's wallet signs and pays for every transaction.
 * Results are read back from studionet after finality.
 */

import { useState, useCallback } from 'react'
import { createClient, chains } from 'genlayer-js'
import type {
  WeatherDecision,
  ActivityAssessment,
  ComparisonResult,
  AlertsResult,
  WeatherAlert,
  AssessActivityRequest,
  CompareLocationsRequest,
  CheckAlertsRequest,
} from '@/types'

const TransactionStatus = { FINALIZED: 'FINALIZED' } as const

const CONTRACT_ADDRESSES = {
  weatherAnalysis: (process.env.NEXT_PUBLIC_GENLAYER_WEATHER_ANALYSIS_ADDRESS || '') as `0x${string}`,
  travelComparison: (process.env.NEXT_PUBLIC_GENLAYER_TRAVEL_COMPARISON_ADDRESS || '') as `0x${string}`,
  activityRisk: (process.env.NEXT_PUBLIC_GENLAYER_ACTIVITY_RISK_ADDRESS || '') as `0x${string}`,
  weatherAlert: (process.env.NEXT_PUBLIC_GENLAYER_WEATHER_ALERT_ADDRESS || '') as `0x${string}`,
}

// Fallback: fetch addresses from API (since we don't have NEXT_PUBLIC_ vars yet)
let addressCache: Record<string, string> | null = null
async function getAddresses() {
  if (
    CONTRACT_ADDRESSES.weatherAnalysis &&
    CONTRACT_ADDRESSES.weatherAnalysis !== '0x'
  ) {
    return CONTRACT_ADDRESSES
  }
  if (!addressCache) {
    const res = await fetch('/api/contracts/addresses')
    const json = await res.json() as { ok: boolean; data: Record<string, string> }
    if (json.ok) addressCache = json.data
  }
  return {
    weatherAnalysis: (addressCache?.weatherAnalysis ?? '') as `0x${string}`,
    travelComparison: (addressCache?.travelComparison ?? '') as `0x${string}`,
    activityRisk: (addressCache?.activityRisk ?? '') as `0x${string}`,
    weatherAlert: (addressCache?.weatherAlert ?? '') as `0x${string}`,
  }
}

// Build a genlayer client using window.ethereum as provider.
// endpoint routes all HTTP fallback and read calls through our server proxy to
// avoid CORS failures: genlayer-js falls back from window.ethereum to a direct
// fetch() when MetaMask doesn't handle a method, and studionet blocks that fetch.
function getWalletClient(address: string) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available')
  }
  return createClient({
    chain: chains.studionet,
    account: address as `0x${string}`,
    provider: window.ethereum,
    endpoint: `${window.location.origin}/api/rpc`,
  })
}

// Wait for a GenLayer transaction to reach FINALIZED status
async function waitForFinality(
  client: ReturnType<typeof getWalletClient>,
  txHash: string,
  timeoutMs = 300_000,
): Promise<void> {
  await client.waitForTransactionReceipt({
    hash: txHash as Parameters<typeof client.waitForTransactionReceipt>[0]['hash'],
    status: TransactionStatus.FINALIZED as Parameters<typeof client.waitForTransactionReceipt>[0]['status'],
    interval: 3000,
    retries: Math.ceil(timeoutMs / 3000),
  })
}

// ─── Weather Analysis ─────────────────────────────────────────────────────────

export function useClientWeatherAnalysis(walletAddress: string | null) {
  const [result, setResult] = useState<WeatherDecision | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (params: {
    lat: string
    lon: string
    query: string
    location_name: string
  }): Promise<WeatherDecision | null> => {
    if (!walletAddress) { setError('Connect your wallet first'); return null }
    setIsAnalyzing(true)
    setError(null)
    setTxHash(null)

    try {
      const addresses = await getAddresses()
      const client = getWalletClient(walletAddress)

      const hash = await client.writeContract({
        address: addresses.weatherAnalysis,
        functionName: 'analyze_weather',
        args: [params.lat, params.lon, params.query, params.location_name],
        value: BigInt(0),
      }) as string
      setTxHash(hash)

      await waitForFinality(client, hash)

      const raw = await client.readContract({
        address: addresses.weatherAnalysis,
        functionName: 'get_analysis',
        args: [],
      })
      const parsed = JSON.parse(raw as string) as WeatherDecision
      setResult(parsed)
      return parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('User rejected') ? 'Transaction rejected by user.' : msg)
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }, [walletAddress])

  const clearResult = useCallback(() => { setResult(null); setError(null); setTxHash(null) }, [])
  return { result, isAnalyzing, txHash, error, analyze, clearResult }
}

// ─── Travel Comparison ────────────────────────────────────────────────────────

export function useClientTravelComparison(walletAddress: string | null) {
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const compare = useCallback(async (params: CompareLocationsRequest): Promise<ComparisonResult | null> => {
    if (!walletAddress) { setError('Connect your wallet first'); return null }
    setIsLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const addresses = await getAddresses()
      const client = getWalletClient(walletAddress)

      const hash = await client.writeContract({
        address: addresses.travelComparison,
        functionName: 'compare_locations',
        args: [JSON.stringify(params.locations), params.purpose, params.travel_date],
        value: BigInt(0),
      }) as string
      setTxHash(hash)

      await waitForFinality(client, hash)

      const raw = await client.readContract({
        address: addresses.travelComparison,
        functionName: 'get_comparison',
        args: [],
      })
      const parsed = JSON.parse(raw as string) as ComparisonResult
      setResult(parsed)
      return parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('User rejected') ? 'Transaction rejected by user.' : msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  const clearResult = useCallback(() => { setResult(null); setError(null); setTxHash(null) }, [])
  return { result, isLoading, txHash, error, compare, clearResult }
}

// ─── Activity Risk ────────────────────────────────────────────────────────────

export function useClientActivityRisk(walletAddress: string | null) {
  const [result, setResult] = useState<ActivityAssessment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assess = useCallback(async (params: AssessActivityRequest): Promise<ActivityAssessment | null> => {
    if (!walletAddress) { setError('Connect your wallet first'); return null }
    setIsLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const addresses = await getAddresses()
      const client = getWalletClient(walletAddress)

      const hash = await client.writeContract({
        address: addresses.activityRisk,
        functionName: 'assess_activity',
        args: [params.lat, params.lon, params.activity, params.location_name, params.target_date, params.duration_hours],
        value: BigInt(0),
      }) as string
      setTxHash(hash)

      await waitForFinality(client, hash)

      const raw = await client.readContract({
        address: addresses.activityRisk,
        functionName: 'get_assessment',
        args: [],
      })
      const parsed = JSON.parse(raw as string) as ActivityAssessment
      setResult(parsed)
      return parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('User rejected') ? 'Transaction rejected by user.' : msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  const clearResult = useCallback(() => { setResult(null); setError(null); setTxHash(null) }, [])
  return { result, isLoading, txHash, error, assess, clearResult }
}

// ─── Weather Alerts ───────────────────────────────────────────────────────────

export function useClientWeatherAlerts(walletAddress: string | null) {
  const [result, setResult] = useState<AlertsResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkAlerts = useCallback(async (params: CheckAlertsRequest): Promise<AlertsResult | null> => {
    if (!walletAddress) { setError('Connect your wallet first'); return null }
    setIsLoading(true)
    setError(null)
    setTxHash(null)

    try {
      const addresses = await getAddresses()
      const client = getWalletClient(walletAddress)

      const hash = await client.writeContract({
        address: addresses.weatherAlert,
        functionName: 'check_alerts',
        args: [params.lat, params.lon, params.location_name, params.lookahead_hours],
        value: BigInt(0),
      }) as string
      setTxHash(hash)

      await waitForFinality(client, hash)

      const raw = await client.readContract({
        address: addresses.weatherAlert,
        functionName: 'get_alerts',
        args: [],
      })
      // get_alerts returns a JSON array string
      const rawStr = raw as string
      let alerts: AlertsResult['alerts']
      try {
        const maybeArr = JSON.parse(rawStr)
        alerts = Array.isArray(maybeArr) ? maybeArr : (maybeArr as AlertsResult).alerts ?? []
      } catch {
        alerts = []
      }
      const parsedRaw = JSON.parse(rawStr) as AlertsResult | WeatherAlert[]
      const parsed: AlertsResult = Array.isArray(parsedRaw)
        ? {
            alerts,
            location: params.location_name,
            lat: params.lat,
            lon: params.lon,
            overall_severity: alerts[0]?.severity ?? 'WATCH',
            alert_count: alerts.length,
            summary: '',
          }
        : parsedRaw
      setResult(parsed)
      return parsed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('User rejected') ? 'Transaction rejected by user.' : msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress])

  const clearResult = useCallback(() => { setResult(null); setError(null); setTxHash(null) }, [])
  return { result, isLoading, txHash, error, checkAlerts, clearResult }
}
