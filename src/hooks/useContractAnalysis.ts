'use client'

import { useState, useCallback } from 'react'
import type {
  WeatherDecision,
  ActivityAssessment,
  ComparisonResult,
  AlertsResult,
  ActivityComparisonResult,
  BestDateResult,
  AssessActivityRequest,
  CompareLocationsRequest,
  CheckAlertsRequest,
  ActivityCompareRequest,
  BestDateRequest,
  ApiResponse,
} from '@/types'

const TIMEOUT_MSG =
  'GenLayer contract timed out. Studionet transactions take 2-5 minutes. Please try again.'

async function safeJson<T>(res: Response): Promise<ApiResponse<T>> {
  const ct = res.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    // Vercel gateway timeout or similar non-JSON error
    throw new Error(TIMEOUT_MSG)
  }
  return res.json() as Promise<ApiResponse<T>>
}

// ─── useContractAnalysis ─────────────────────────────────────────────────────

type AnalysisState = {
  result: WeatherDecision | null
  isAnalyzing: boolean
  error: string | null
  analyze: (params: {
    lat: string
    lon: string
    query: string
    location_name: string
  }) => Promise<WeatherDecision | null>
  clearResult: () => void
}

export function useContractAnalysis(): AnalysisState {
  const [result, setResult] = useState<WeatherDecision | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(
    async (params: {
      lat: string
      lon: string
      query: string
      location_name: string
    }): Promise<WeatherDecision | null> => {
      setIsAnalyzing(true)
      setError(null)
      try {
        const res = await fetch('/api/weather/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await safeJson<WeatherDecision>(res)
        if (json.ok) {
          setResult(json.data)
          return json.data
        } else {
          setError(json.error)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Analysis failed')
        return null
      } finally {
        setIsAnalyzing(false)
      }
    },
    [],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isAnalyzing, error, analyze, clearResult }
}

// ─── useActivityRisk ─────────────────────────────────────────────────────────

export function useActivityRisk(): {
  result: ActivityAssessment | null
  isLoading: boolean
  error: string | null
  assess: (params: AssessActivityRequest) => Promise<ActivityAssessment | null>
  clearResult: () => void
} {
  const [result, setResult] = useState<ActivityAssessment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assess = useCallback(
    async (params: AssessActivityRequest): Promise<ActivityAssessment | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await safeJson<ActivityAssessment>(res)
        if (json.ok) {
          setResult(json.data)
          return json.data
        } else {
          setError(json.error)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Activity assessment failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isLoading, error, assess, clearResult }
}

// ─── useTravelComparison ─────────────────────────────────────────────────────

export function useTravelComparison(): {
  result: ComparisonResult | null
  isLoading: boolean
  error: string | null
  compare: (params: CompareLocationsRequest) => Promise<ComparisonResult | null>
  clearResult: () => void
} {
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compare = useCallback(
    async (params: CompareLocationsRequest): Promise<ComparisonResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await safeJson<ComparisonResult>(res)
        if (json.ok) {
          setResult(json.data)
          return json.data
        } else {
          setError(json.error)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Travel comparison failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isLoading, error, compare, clearResult }
}

// ─── useWeatherAlerts ────────────────────────────────────────────────────────

export function useWeatherAlerts(): {
  result: AlertsResult | null
  isLoading: boolean
  error: string | null
  checkAlerts: (params: CheckAlertsRequest) => Promise<AlertsResult | null>
  clearResult: () => void
} {
  const [result, setResult] = useState<AlertsResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkAlerts = useCallback(
    async (params: CheckAlertsRequest): Promise<AlertsResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await safeJson<AlertsResult>(res)
        if (json.ok) {
          setResult(json.data)
          return json.data
        } else {
          setError(json.error)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Alert check failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isLoading, error, checkAlerts, clearResult }
}

// ─── useActivityComparison ───────────────────────────────────────────────────

export function useActivityComparison(): {
  result: ActivityComparisonResult | null
  isLoading: boolean
  error: string | null
  compare: (params: ActivityCompareRequest) => Promise<ActivityComparisonResult | null>
  clearResult: () => void
} {
  const [result, setResult] = useState<ActivityComparisonResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compare = useCallback(
    async (params: ActivityCompareRequest): Promise<ActivityComparisonResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/compare/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await safeJson<ActivityComparisonResult>(res)
        if (json.ok) {
          setResult(json.data)
          return json.data
        } else {
          setError(json.error)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Activity comparison failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isLoading, error, compare, clearResult }
}

// ─── useBestDateFinder ───────────────────────────────────────────────────────

export function useBestDateFinder(): {
  result: BestDateResult | null
  isLoading: boolean
  error: string | null
  findBestDate: (params: BestDateRequest) => Promise<BestDateResult | null>
  clearResult: () => void
} {
  const [result, setResult] = useState<BestDateResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const findBestDate = useCallback(
    async (params: BestDateRequest): Promise<BestDateResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/activity/best-date', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
        const json = await safeJson<BestDateResult>(res)
        if (json.ok) {
          setResult(json.data)
          return json.data
        } else {
          setError(json.error)
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Best-date finder failed')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const clearResult = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, isLoading, error, findBestDate, clearResult }
}
