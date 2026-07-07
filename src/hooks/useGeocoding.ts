'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GeocodingResult, ApiResponse } from '@/types'

type GeocodingState = {
  results: GeocodingResult[]
  isSearching: boolean
  error: string | null
  query: string
  setQuery: (q: string) => void
  clearResults: () => void
}

export function useGeocoding(debounceMs: number = 350): GeocodingState {
  const [query, setQueryState] = useState('')
  const [results, setResults] = useState<GeocodingResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (query.length < 2) {
      return
    }

    const controller = new AbortController()

    const timerId = setTimeout(async () => {
      setIsSearching(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        )
        const json = (await res.json()) as ApiResponse<GeocodingResult[]>
        if (json.ok) {
          setResults(json.data)
        } else {
          setError(json.error)
          setResults([])
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // request was cancelled — do nothing
          return
        }
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, debounceMs)

    return () => {
      clearTimeout(timerId)
      controller.abort()
    }
  }, [query, debounceMs])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    if (q.length < 2) {
      setResults([])
      setIsSearching(false)
      setError(null)
    }
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  return {
    results,
    isSearching,
    error,
    query,
    setQuery,
    clearResults,
  }
}
