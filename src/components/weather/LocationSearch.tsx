'use client'

import { useRef, useEffect, useState, useCallback, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, LocateFixed, Loader2 } from 'lucide-react'
import { useGeocoding } from '@/hooks/useGeocoding'
import type { GeocodingResult } from '@/types'

type LocationSearchProps = {
  onSelect: (location: GeocodingResult) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('')
}

export function LocationSearch({
  onSelect,
  placeholder = 'Search for a location…',
  className,
  autoFocus = false,
}: LocationSearchProps) {
  const { results, isSearching, error, query, setQuery, clearResults } =
    useGeocoding(350)

  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [isLocating, setIsLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const listboxId = useId()

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (location: GeocodingResult) => {
      onSelect(location)
      setQuery('')
      clearResults()
      setIsOpen(false)
      setActiveIndex(-1)
    },
    [onSelect, setQuery, clearResults]
  )

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setIsLocating(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`
          )
          const json = (await res.json()) as { ok: boolean; data?: GeocodingResult; error?: string }
          if (json.ok && json.data) {
            onSelect(json.data)
          } else {
            setGeoError(json.error ?? 'Could not identify your location.')
          }
        } catch {
          setGeoError('Failed to look up your location.')
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location access denied. Please allow it in your browser settings.')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoError('Location unavailable. Try searching manually.')
        } else {
          setGeoError('Could not determine your location.')
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }, [onSelect])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex])
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
        setActiveIndex(-1)
        inputRef.current?.blur()
      }
    },
    [isOpen, results, activeIndex, handleSelect]
  )

  const showDropdown =
    isOpen && query.length >= 2 && (isSearching || results.length > 0 || !!error)

  const showEmpty =
    isOpen &&
    !isSearching &&
    !error &&
    results.length === 0 &&
    query.length >= 2

  return (
    <div ref={containerRef} className={`relative${className ? ` ${className}` : ''}`}>
      {/* Input */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value
            setQuery(nextQuery)
            setIsOpen(nextQuery.length >= 2)
            setActiveIndex(-1)
            if (geoError) setGeoError(null)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true)
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-2xl bg-white dark:bg-[rgba(4,13,28,0.92)] border border-slate-200 dark:border-[rgba(14,165,233,0.18)] px-4 py-3 pl-10 pr-11 text-sm text-slate-900 dark:text-[#dff0ff] placeholder:text-slate-400 dark:placeholder:text-[#3d6880] focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-[rgba(14,165,233,0.2)] focus:border-blue-400 dark:focus:border-[rgba(14,165,233,0.4)]"
          aria-label="Search for a location"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showDropdown || showEmpty}
          role="combobox"
        />
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          title="Use my current location"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 dark:text-[#3d6880] hover:text-blue-500 dark:hover:text-cyan-400 hover:bg-blue-50 dark:hover:bg-[rgba(14,165,233,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Use my current location"
        >
          {isLocating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LocateFixed size={16} />
          )}
        </button>
      </div>

      {/* Geo error */}
      {geoError && (
        <p className="mt-1.5 text-xs text-red-500 px-1">{geoError}</p>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {(showDropdown || showEmpty) && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 rounded-2xl glass dark:bg-[rgba(6,20,40,0.96)] border border-white/60 dark:border-[rgba(14,165,233,0.15)] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.7)] overflow-hidden z-50"
            role="listbox"
            id={listboxId}
          >
            {/* Loading skeletons */}
            {isSearching && (
              <>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3"
                    aria-hidden="true"
                  >
                    <div className="w-4 h-4 rounded-full bg-slate-200 animate-pulse shrink-0" />
                    <div className="flex-1 h-4 rounded bg-slate-200 animate-pulse" />
                    <div className="w-6 h-4 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </>
            )}

            {/* Error */}
            {!isSearching && error && (
              <div className="px-4 py-3 text-sm text-red-500">{error}</div>
            )}

            {/* Results */}
            {!isSearching &&
              !error &&
              results.map((result, index) => (
                <button
                  key={`${result.lat}-${result.lon}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center gap-3 px-4 py-3 w-full text-left cursor-pointer transition-colors${
                    index === activeIndex ? ' bg-blue-50' : ' hover:bg-blue-50'
                  }`}
                >
                  <MapPin size={16} className="text-blue-400 shrink-0" />
                  <span className="text-sm text-slate-800 flex-1 truncate">
                    {result.display_name}
                  </span>
                  <span className="text-base leading-none shrink-0" aria-hidden="true">
                    {countryCodeToFlag(result.country_code)}
                  </span>
                </button>
              ))}

            {/* Empty state */}
            {showEmpty && !isSearching && (
              <div className="px-4 py-3 text-sm text-slate-500">
                No locations found for &apos;{query}&apos;
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
