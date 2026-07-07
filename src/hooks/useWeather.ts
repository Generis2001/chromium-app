'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ApiResponse } from '@/types'

type CurrentWeatherResponse = {
  tempC: number
  feelsLikeC: number
  weatherCode: number
  windKmh: number
  gustsKmh: number
  precipMm: number
  rainMm: number
  snowMm: number
  humidityPct: number
  pressureHpa: number
  visibilityM: number
  uvIndex: number
  isDay: boolean
  cloudCoverPct: number
  timezone: string
  timezone_abbreviation: string
  utc_offset_seconds: number
}

type WeatherState = {
  current: CurrentWeatherResponse | null
  forecast: Record<string, unknown> | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

const REFETCH_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function useWeather(lat: string | null, lon: string | null): WeatherState {
  const [current, setCurrent] = useState<CurrentWeatherResponse | null>(null)
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Keep a ref to the latest lat/lon so the interval callback is always fresh
  const latRef = useRef(lat)
  const lonRef = useRef(lon)

  useEffect(() => {
    latRef.current = lat
    lonRef.current = lon
  }, [lat, lon])

  const fetchWeather = useCallback(
    async (
      fetchLat: string,
      fetchLon: string,
      options?: { forceFresh?: boolean; preserveCurrent?: boolean }
    ): Promise<void> => {
      const forceFresh = options?.forceFresh ?? false
      const preserveCurrent = options?.preserveCurrent ?? false
      const querySuffix = forceFresh ? `&refresh=${Date.now()}` : ''

      if (!preserveCurrent) {
        setIsLoading(true)
      }
      setError(null)
      try {
        const [currentRes, forecastRes] = await Promise.all([
          fetch(
            `/api/weather/current?lat=${encodeURIComponent(fetchLat)}&lon=${encodeURIComponent(fetchLon)}${querySuffix}`,
            forceFresh ? { cache: 'no-store' } : undefined
          ),
          fetch(
            `/api/weather/forecast?lat=${encodeURIComponent(fetchLat)}&lon=${encodeURIComponent(fetchLon)}&days=7&hours=24${querySuffix}`,
            forceFresh ? { cache: 'no-store' } : undefined
          ),
        ])

        const [currentJson, forecastJson] = await Promise.all([
          currentRes.json() as Promise<ApiResponse<CurrentWeatherResponse>>,
          forecastRes.json() as Promise<ApiResponse<Record<string, unknown>>>,
        ])

        if (currentJson.ok) {
          setCurrent(currentJson.data)
        } else {
          if (!preserveCurrent) {
            setCurrent(null)
          }
          setError(currentJson.error)
        }

        if (forecastJson.ok) {
          setForecast(forecastJson.data)
        } else {
          if (!preserveCurrent) {
            setForecast(null)
          }
        }

        setLastUpdated(new Date())
      } catch (err) {
        if (!preserveCurrent) {
          setCurrent(null)
          setForecast(null)
        }
        setError(err instanceof Error ? err.message : 'Failed to fetch weather')
      } finally {
        if (!preserveCurrent) {
          setIsLoading(false)
        }
      }
    },
    []
  )

  const refresh = useCallback(async (): Promise<void> => {
    const currentLat = latRef.current
    const currentLon = lonRef.current
    if (!currentLat || !currentLon) return
    setIsRefreshing(true)
    try {
      await fetchWeather(currentLat, currentLon, { forceFresh: true, preserveCurrent: true })
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchWeather])

  // Fetch on lat/lon change
  useEffect(() => {
    if (!lat || !lon) return
    const id = setTimeout(() => void fetchWeather(lat, lon), 0)
    return () => clearTimeout(id)
  }, [lat, lon, fetchWeather])

  // Auto-refetch every 10 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentLat = latRef.current
      const currentLon = lonRef.current
      if (currentLat && currentLon) {
        void fetchWeather(currentLat, currentLon)
      }
    }, REFETCH_INTERVAL_MS)

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchWeather])

  return {
    current,
    forecast,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  }
}
