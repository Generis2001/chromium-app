'use client'

/**
 * useClientContract
 *
 * Client-side GenLayer contract invocation via window.ethereum.
 * The user's wallet signs and pays for every transaction.
 * Results come from the server-side simulate endpoint (same path
 * that worked before payments were added) — no dependency on the
 * broken write→readContract state cycle.
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

// Fees in wei (1 GEN = 1e18 wei)
const FEES = {
  weatherAnalysis: BigInt('500000000000000000'),   // 0.5 GEN
  travelComparison: BigInt('1000000000000000000'),  // 1 GEN
  activityRisk: BigInt('500000000000000000'),        // 0.5 GEN
  weatherAlert: BigInt('500000000000000000'),        // 0.5 GEN
} as const

const CONTRACT_ADDRESSES = {
  weatherAnalysis: (process.env.NEXT_PUBLIC_GENLAYER_WEATHER_ANALYSIS_ADDRESS || '') as `0x${string}`,
  travelComparison: (process.env.NEXT_PUBLIC_GENLAYER_TRAVEL_COMPARISON_ADDRESS || '') as `0x${string}`,
  activityRisk: (process.env.NEXT_PUBLIC_GENLAYER_ACTIVITY_RISK_ADDRESS || '') as `0x${string}`,
  weatherAlert: (process.env.NEXT_PUBLIC_GENLAYER_WEATHER_ALERT_ADDRESS || '') as `0x${string}`,
}

let addressCache: Record<string, string> | null = null
async function getAddresses() {
  if (CONTRACT_ADDRESSES.weatherAnalysis && CONTRACT_ADDRESSES.weatherAnalysis !== '0x') {
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

// Fetch result from the server-side API routes — the path that worked before payments
async function fetchResult<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json() as { ok: boolean; data?: T; error?: string }
  if (!json.ok) throw new Error(json.error ?? `Request to ${endpoint} failed`)
  if (json.data == null) throw new Error('No result returned from server')
  return json.data
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

      // 1. Submit payment via MetaMask (blockchain record)
      const hash = await client.writeContract({
        address: addresses.weatherAnalysis,
        functionName: 'analyze_weather',
        args: [params.lat, params.lon, params.query, params.location_name],
        value: FEES.weatherAnalysis,
      }) as string
      setTxHash(hash)

      // 2. Get result from the server-side route that was working before payments
      const parsed = await fetchResult<WeatherDecision>('/api/weather/analyze', {
        lat: params.lat,
        lon: params.lon,
        query: params.query,
        location_name: params.location_name,
      })

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

      // 1. Submit payment via MetaMask (blockchain record)
      const hash = await client.writeContract({
        address: addresses.travelComparison,
        functionName: 'compare_locations',
        args: [JSON.stringify(params.locations), params.purpose, params.travel_date],
        value: FEES.travelComparison,
      }) as string
      setTxHash(hash)

      // 2. Get result from the server-side route that was working before payments
      const parsed = await fetchResult<ComparisonResult>('/api/compare', {
        locations: params.locations,
        purpose: params.purpose,
        travel_date: params.travel_date,
      })

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

      // 1. Submit payment via MetaMask (blockchain record)
      const hash = await client.writeContract({
        address: addresses.activityRisk,
        functionName: 'assess_activity',
        args: [params.lat, params.lon, params.activity, params.location_name, params.target_date, params.duration_hours],
        value: FEES.activityRisk,
      }) as string
      setTxHash(hash)

      // 2. Get result from the server-side route that was working before payments
      const parsed = await fetchResult<ActivityAssessment>('/api/activity', {
        lat: params.lat,
        lon: params.lon,
        activity: params.activity,
        location_name: params.location_name,
        target_date: params.target_date,
        duration_hours: params.duration_hours,
      })

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

      // 1. Submit payment via MetaMask (blockchain record)
      const hash = await client.writeContract({
        address: addresses.weatherAlert,
        functionName: 'check_alerts',
        args: [params.lat, params.lon, params.location_name, params.lookahead_hours],
        value: FEES.weatherAlert,
      }) as string
      setTxHash(hash)

      // 2. Get result from the server-side route that was working before payments
      const parsedRaw = await fetchResult<AlertsResult | WeatherAlert[]>('/api/alerts', {
        lat: params.lat,
        lon: params.lon,
        location_name: params.location_name,
        lookahead_hours: params.lookahead_hours,
      })

      const parsed: AlertsResult = Array.isArray(parsedRaw)
        ? {
            alerts: parsedRaw as WeatherAlert[],
            location: params.location_name,
            lat: params.lat,
            lon: params.lon,
            overall_severity: (parsedRaw as WeatherAlert[])[0]?.severity ?? 'NONE',
            alert_count: (parsedRaw as WeatherAlert[]).length,
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
