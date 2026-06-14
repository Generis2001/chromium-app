'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Loader2 } from 'lucide-react'
import { useClientWeatherAnalysis } from '@/hooks/useClientContract'
import { useIsland } from '@/components/dynamic-island'
import { DecisionBadge } from '@/components/ui/DecisionBadge'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ContractBadge } from '@/components/weather/ContractBadge'
import { AiExplanationPanel } from '@/components/weather/AiExplanationPanel'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { GeocodingResult } from '@/types'

type WeatherDecisionEngineProps = {
  location: GeocodingResult | null
  walletAddress: string | null
  className?: string
}

const SUGGESTIONS = [
  'Is it safe to fly tomorrow?',
  'Best day for a marathon this week?',
  'Will it rain in the afternoon?',
  'Is it too windy for outdoor dining?',
  'Good conditions for cycling today?',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getAlternativeDayName(index: number): string {
  const today = new Date()
  const d = new Date(today)
  d.setDate(today.getDate() + index)
  return DAY_NAMES[d.getDay()]
}

export function WeatherDecisionEngine({ location, walletAddress, className }: WeatherDecisionEngineProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { result, isAnalyzing, txHash, error, analyze } = useClientWeatherAnalysis(walletAddress)
  const island = useIsland()

  const handleAnalyze = async () => {
    if (!location || !query.trim()) return
    const data = await analyze({
      lat: location.lat,
      lon: location.lon,
      query: query.trim(),
      location_name: location.display_name,
    })
    if (data) {
      island.setState('weather', {
        location: data.location,
        temp: data.temp_c,
        condition: data.condition_class,
        risk_level: data.risk_level,
        decision: data.decision,
        confidence: data.confidence,
        reasoning: data.reasoning,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void handleAnalyze()
  }

  const handleSuggestion = (s: string) => {
    setQuery(s)
    inputRef.current?.focus()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        'bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100 p-6',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800 text-lg">Weather Intelligence</h2>
        <p className="text-slate-400 text-sm mt-0.5">Ask anything about weather conditions</p>
      </div>

      {/* Input row */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
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
            placeholder={location ? 'Ask about weather...' : 'Select a location first'}
            disabled={!location}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          onClick={() => void handleAnalyze()}
          disabled={!location || !query.trim() || isAnalyzing || !walletAddress}
          className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shrink-0"
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Analyzing</span>
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </div>

      {/* Suggestion chips */}
      {!result && !isAnalyzing && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={!location}
              className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isAnalyzing && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-24 ml-auto rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            {txHash && (
              <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">
                Tx: {txHash.slice(0, 12)}…{txHash.slice(-8)}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && !isAnalyzing && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-4 space-y-4"
          >
            {/* Decision row */}
            <div className="flex items-center gap-3 flex-wrap">
              <DecisionBadge decision={result.decision} size="lg" />
              <span className="text-sm text-slate-500">
                {result.confidence}% confident
              </span>
              <div className="ml-auto">
                <ContractBadge contract="WeatherAnalysis" />
              </div>
            </div>

            {/* Reasoning */}
            <p className="text-slate-600 text-sm leading-relaxed">
              {result.reasoning}
            </p>

            {/* Recommendation */}
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Recommendation</p>
              <p className="text-sm text-blue-800">{result.recommendation}</p>
            </div>

            {/* Key factors + alternative days */}
            {(result.key_factors.length > 0 || result.alternative_days.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {result.key_factors.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Risk Factors</p>
                    <ul className="space-y-1">
                      {result.key_factors.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-blue-400 mt-0.5">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.alternative_days.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2">Alternative Days</p>
                    <ul className="space-y-1">
                      {result.alternative_days.slice(0, 3).map((dayIdx, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="text-emerald-400 mt-0.5">•</span>
                          <span>{getAlternativeDayName(dayIdx)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Comfort + Risk badges */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <ScoreRing score={result.comfort_score} size={56} label="Comfort" />
                </div>
                <RiskBadge risk={result.risk_level} />
              </div>
            </div>

            <AiExplanationPanel
              contractType="weather_decision"
              contractResult={result}
              userQuery={query}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
