'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Loader2, GripVertical } from 'lucide-react'
import { useTravelComparison, useActivityComparison } from '@/hooks/useContractAnalysis'
import { useGeocoding } from '@/hooks/useGeocoding'
import { useIsland } from '@/components/dynamic-island'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { ContractBadge } from '@/components/weather/ContractBadge'
import { AiExplanationPanel } from '@/components/weather/AiExplanationPanel'
import { cn } from '@/lib/utils'
import { SUPPORTED_ACTIVITIES } from '@/types'
import type { GeocodingResult, RankedLocation, ActivityCityScore } from '@/types'

type LocationEntry = {
  id: string
  name: string
  lat: string
  lon: string
}

const TRAVEL_PURPOSE_OPTIONS = [
  { value: 'travel', label: 'General Travel' },
  { value: 'business', label: 'Business' },
  { value: 'outdoor_sports', label: 'Outdoor Sports' },
  { value: 'photography', label: 'Photography' },
  { value: 'hiking', label: 'Hiking' },
  { value: 'beach', label: 'Beach' },
] as const

const ACTIVITY_LABELS: Record<string, string> = {
  farming: 'Farming',
  outdoor_sports: 'Outdoor Sports',
  construction: 'Construction',
  camping: 'Camping',
  photography: 'Photography',
  travel: 'Travel',
  marathon_running: 'Marathon',
  cycling: 'Cycling',
  beach: 'Beach',
  skiing: 'Skiing',
}

const SUITABILITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SUITABLE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  MARGINAL: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  UNSUITABLE: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

let locationIdCounter = 0
function nextId(): string {
  locationIdCounter += 1
  return `loc-${locationIdCounter}`
}

type CompareMode = 'travel' | 'activity'

export function MultiLocationComparison({ className }: { className?: string }) {
  const [locations, setLocations] = useState<LocationEntry[]>([])
  const [mode, setMode] = useState<CompareMode>('travel')
  const [purpose, setPurpose] = useState('travel')
  const [activity, setActivity] = useState(SUPPORTED_ACTIVITIES[0])
  const [travelDate, setTravelDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [showSearch, setShowSearch] = useState(false)
  const { results, isSearching, query, setQuery } = useGeocoding(300)
  const { result: travelResult, isLoading: travelLoading, error: travelError, compare: travelCompare, clearResult: clearTravelResult } = useTravelComparison()
  const { result: activityResult, isLoading: activityLoading, error: activityError, compare: activityCompare, clearResult: clearActivityResult } = useActivityComparison()
  const island = useIsland()
  const searchRef = useRef<HTMLDivElement>(null)

  const isLoading = mode === 'travel' ? travelLoading : activityLoading
  const error = mode === 'travel' ? travelError : activityError

  const addLocation = (geo: GeocodingResult) => {
    if (locations.length >= 5) return
    if (locations.some((l) => l.lat === geo.lat && l.lon === geo.lon)) return
    setLocations((prev) => [
      ...prev,
      { id: nextId(), name: geo.display_name, lat: geo.lat, lon: geo.lon },
    ])
    setQuery('')
    setShowSearch(false)
  }

  const removeLocation = (id: string) => {
    setLocations((prev) => prev.filter((l) => l.id !== id))
  }

  const handleModeSwitch = (next: CompareMode) => {
    setMode(next)
    clearTravelResult()
    clearActivityResult()
  }

  const handleCompare = async () => {
    if (locations.length < 2) return

    if (mode === 'travel') {
      const data = await travelCompare({
        locations: locations.map((l) => ({
          name: l.name.split(',')[0],
          lat: l.lat,
          lon: l.lon,
        })),
        purpose,
        travel_date: travelDate,
      })
      if (data) {
        island.setState('comparison', {
          location: data.best_location,
          temp: 0,
          condition: '',
          risk_level: 'LOW',
          best_location: data.best_location,
          comparison_count: data.ranked_locations.length,
        })
      }
    } else {
      const data = await activityCompare({
        locations: locations.map((l) => ({
          name: l.name.split(',')[0],
          lat: l.lat,
          lon: l.lon,
        })),
        activity,
        target_date: travelDate,
      })
      if (data) {
        island.setState('comparison', {
          location: data.best_location,
          temp: 0,
          condition: '',
          risk_level: 'LOW',
          best_location: data.best_location,
          comparison_count: data.ranked_locations.length,
        })
      }
    }
  }

  const currentResult = mode === 'travel' ? travelResult : activityResult

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={cn(
        'bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100 p-6',
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800 text-lg">Multi-Location Comparison</h2>
        <p className="text-slate-400 text-sm mt-0.5">Compare weather across up to 5 locations</p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-slate-100 p-1 mb-4 gap-1">
        {(['travel', 'activity'] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeSwitch(m)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'travel' ? 'Travel Purpose' : 'Activity'}
          </button>
        ))}
      </div>

      {/* Location list + add button */}
      <div className="space-y-2 mb-4">
        {locations.map((loc) => (
          <div
            key={loc.id}
            className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5"
          >
            <GripVertical size={14} className="text-slate-300 shrink-0" />
            <span className="text-sm text-slate-700 flex-1 truncate">{loc.name}</span>
            <button
              onClick={() => removeLocation(loc.id)}
              className="size-5 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0"
            >
              <X size={12} className="text-slate-400" />
            </button>
          </div>
        ))}

        {locations.length < 5 && (
          <div ref={searchRef} className="relative">
            {showSearch ? (
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a location..."
                  autoFocus
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                />
                <AnimatePresence>
                  {query.length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-full mt-1 left-0 right-0 rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto"
                    >
                      {isSearching ? (
                        <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
                      ) : results.length > 0 ? (
                        results.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => addLocation(r)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 transition-colors truncate"
                          >
                            {r.display_name}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-400">
                          No locations found
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="w-full flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
              >
                <Plus size={14} />
                <span>Add location</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Options row */}
      <div className="flex items-end gap-3 mb-4">
        {mode === 'travel' ? (
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {TRAVEL_PURPOSE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Activity</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value as typeof activity)}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {SUPPORTED_ACTIVITIES.map((act) => (
                <option key={act} value={act}>
                  {ACTIVITY_LABELS[act] ?? act}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {mode === 'travel' ? 'Travel Date' : 'Target Date'}
          </label>
          <input
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <button
          onClick={() => void handleCompare()}
          disabled={locations.length < 2 || isLoading}
          className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shrink-0 h-[42px]"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Comparing</span>
            </>
          ) : (
            'Compare'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {currentResult && !isLoading && (
          <motion.div
            key={`result-${mode}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Best location banner */}
            <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Best Choice</p>
              <p className="text-sm text-emerald-800 font-medium">{currentResult.best_location}</p>
              <p className="text-xs text-emerald-600 mt-1">{currentResult.reasoning}</p>
            </div>

            {/* Partial failures notice */}
            {'partial_failures' in currentResult && currentResult.partial_failures.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-2 text-xs text-amber-700">
                Could not assess: {currentResult.partial_failures.join(', ')}
              </div>
            )}

            {/* Ranked list — Travel mode */}
            {mode === 'travel' && 'ranked_locations' in currentResult && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">Rankings</p>
                {(currentResult.ranked_locations as RankedLocation[]).map((loc) => (
                  <div
                    key={loc.name}
                    className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-slate-300 w-6">
                        #{loc.rank}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{loc.name}</p>
                        <p className="text-xs text-slate-400">{loc.condition}</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-blue-500">
                      {loc.overall_score}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ranked list — Activity mode */}
            {mode === 'activity' && 'ranked_locations' in currentResult && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">Rankings</p>
                {(currentResult.ranked_locations as ActivityCityScore[]).map((loc) => {
                  const colors = SUITABILITY_COLORS[loc.suitability] ?? SUITABILITY_COLORS.MARGINAL
                  return (
                    <div
                      key={loc.name}
                      className={`rounded-xl ${colors.bg} border ${colors.border} px-4 py-3 space-y-1`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-300 w-6">
                            #{loc.rank}
                          </span>
                          <p className="text-sm font-medium text-slate-700">{loc.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase ${colors.text}`}>
                            {loc.suitability}
                          </span>
                          <RiskBadge risk={loc.risk_level} size="sm" />
                        </div>
                      </div>
                      {loc.key_concerns.length > 0 && (
                        <p className="text-xs text-slate-500 pl-8">
                          {loc.key_concerns[0]}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Purpose note + contract badge */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-slate-400 italic">
                {'purpose_note' in currentResult ? currentResult.purpose_note : ''}
              </p>
              <ContractBadge contract={mode === 'travel' ? 'TravelComparison' : 'ActivityRisk'} />
            </div>

            <AiExplanationPanel
              contractType={mode === 'travel' ? 'comparison' : 'activity_compare'}
              contractResult={currentResult}
              userQuery={`Compare ${locations.map((l) => l.name.split(',')[0]).join(', ')} for ${mode === 'travel' ? purpose : activity} on ${travelDate}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
