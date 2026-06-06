'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin } from 'lucide-react'
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

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Open dropdown when there are results, a query is in progress, or we have an error
  useEffect(() => {
    if (query.length >= 2) {
      setIsOpen(true)
      setActiveIndex(-1)
    } else {
      setIsOpen(false)
    }
  }, [query, results])

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
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true)
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-2xl bg-white border border-slate-200 px-4 py-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          aria-label="Search for a location"
          aria-autocomplete="list"
          aria-expanded={showDropdown || showEmpty}
          role="combobox"
        />
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {(showDropdown || showEmpty) && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 rounded-2xl glass border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50"
            role="listbox"
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
