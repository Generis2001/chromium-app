'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GeocodingResult, ApiResponse } from '@/types'

const STORAGE_KEY = 'chromium_location'
const RECENT_KEY = 'chromium_recent_locations'
const MAX_RECENT = 10

type LocationState = {
  location: GeocodingResult | null
  recentLocations: GeocodingResult[]
  isDetecting: boolean
  error: string | null
  setLocation: (loc: GeocodingResult) => void
  detectLocation: () => Promise<void>
  clearLocation: () => void
  addRecentLocation: (loc: GeocodingResult) => void
  clearRecentLocations: () => void
}

function loadRecent(): GeocodingResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (raw) return JSON.parse(raw) as GeocodingResult[]
  } catch {
    // ignore
  }
  return []
}

function loadStoredLocation(): GeocodingResult | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as GeocodingResult
  } catch {
    // ignore parse errors
  }
  return null
}

function saveRecent(locations: GeocodingResult[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(locations))
  } catch {
    // ignore
  }
}

export function useLocation(): LocationState {
  const [location, setLocationState] = useState<GeocodingResult | null>(() => loadStoredLocation())
  const [recentLocations, setRecentLocations] = useState<GeocodingResult[]>(() => loadRecent())
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectLocation = useCallback(async (): Promise<void> => {
    setIsDetecting(true)
    setError(null)
    try {
      const res = await fetch('/api/location/detect')
      const json = (await res.json()) as ApiResponse<GeocodingResult>
      if (json.ok) {
        setLocationState(json.data)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data))
        } catch {
          // ignore storage errors
        }
      } else {
        setError(json.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect location')
    } finally {
      setIsDetecting(false)
    }
  }, [])

  useEffect(() => {
    if (location) return
    const id = setTimeout(() => void detectLocation(), 0)
    return () => clearTimeout(id)
  }, [detectLocation, location])

  const addRecentLocation = useCallback((loc: GeocodingResult) => {
    setRecentLocations((prev) => {
      const filtered = prev.filter(
        (r) => !(r.lat === loc.lat && r.lon === loc.lon),
      )
      const next = [loc, ...filtered].slice(0, MAX_RECENT)
      saveRecent(next)
      return next
    })
  }, [])

  const setLocation = useCallback(
    (loc: GeocodingResult) => {
      setLocationState(loc)
      setError(null)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loc))
      } catch {
        // ignore storage errors
      }
      addRecentLocation(loc)
    },
    [addRecentLocation],
  )

  const clearLocation = useCallback(() => {
    setLocationState(null)
    setError(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
  }, [])

  const clearRecentLocations = useCallback(() => {
    setRecentLocations([])
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      // ignore
    }
  }, [])

  return {
    location,
    recentLocations,
    isDetecting,
    error,
    setLocation,
    detectLocation,
    clearLocation,
    addRecentLocation,
    clearRecentLocations,
  }
}
