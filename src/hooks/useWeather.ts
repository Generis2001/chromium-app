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
  error: string | null
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

const REFETCH_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function useWeather(lat: string | null, lon: string | null): WeatherState {
  const [current, setCurrent] = useState<CurrentWeatherResponse | null>(null)
  const [forecast, setForecast] = useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Keep a ref to the latest lat/lon so the interval callback is always fresh
  const latRef = useRef(lat)
  const lonRef = useRef(lon)
  latRef.current = lat
  lonRef.current = lon

  const fetchWeather = useCallback(
    async (fetchLat: string, fetchLon: string): Promise<void> => {
      setIsLoading(true)
      setError(null)
      try {
        const [currentRes, forecastRes] = await Promise.all([
          fetch(`/api/weather/current?lat=${encodeURIComponent(fetchLat)}&lon=${encodeURIComponent(fetchLon)}`),
          fetch(
            `/api/weather/forecast?lat=${encodeURIComponent(fetchLat)}&lon=${encodeURIComponent(fetchLon)}&days=7&hours=24`
          ),
        ])

        const [currentJson, forecastJson] = await Promise.all([
          currentRes.json() as Promise<ApiResponse<CurrentWeatherResponse>>,
          forecastRes.json() as Promise<ApiResponse<Record<string, unknown>>>,
        ])

        if (currentJson.ok) {
          setCurrent(currentJson.data)
        } else {
          setCurrent(null)
          setError(currentJson.error)
        }

        if (forecastJson.ok) {
          setForecast(forecastJson.data)
        } else {
          setForecast(null)
        }

        setLastUpdated(new Date())
      } catch (err) {
        setCurrent(null)
        setError(err instanceof Error ? err.message : 'Failed to fetch weather')
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const refresh = useCallback(async (): Promise<void> => {
    const currentLat = latRef.current
    const currentLon = lonRef.current
    if (!currentLat || !currentLon) return
    await fetchWeather(currentLat, currentLon)
  }, [fetchWeather])

  // Fetch on lat/lon change
  useEffect(() => {
    if (!lat || !lon) return
    void fetchWeather(lat, lon)
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
    error,
    lastUpdated,
    refresh,
  }
}
