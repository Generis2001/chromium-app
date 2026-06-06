'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertTriangle, ShieldCheck, Clock, Wrench, CalendarDays } from 'lucide-react'
import { useActivityRisk, useBestDateFinder } from '@/hooks/useContractAnalysis'
import { useIsland } from '@/components/dynamic-island'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { ScoreRing } from '@/components/ui/ScoreRing'
import { ContractBadge } from '@/components/weather/ContractBadge'
import { AiExplanationPanel } from '@/components/weather/AiExplanationPanel'
import { cn } from '@/lib/utils'
import { SUPPORTED_ACTIVITIES } from '@/types'
import type { GeocodingResult, SupportedActivity, DateRanking } from '@/types'

type ActivityPlannerProps = {
  location: GeocodingResult | null
  className?: string
}

type PlannerMode = 'assess' | 'best-date'

const ACTIVITY_LABELS: Record<string, string> = {
  farming: 'Farming',
  outdoor_sports: 'Outdoor Sports',
  construction: 'Construction',
  camping: 'Camping',
  photography: 'Photography',
  travel: 'Travel',
  marathon_running: 'Marathon Running',
  cycling: 'Cycling',
  beach: 'Beach',
  skiing: 'Skiing',
}

const SUITABILITY_STYLES: Record<string, string> = {
  SUITABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MARGINAL: 'bg-amber-50 text-amber-700 border-amber-200',
  UNSUITABLE: 'bg-red-50 text-red-700 border-red-200',
}

export function ActivityPlanner({ location, className }: ActivityPlannerProps) {
  const [activity, setActivity] = useState<SupportedActivity>(SUPPORTED_ACTIVITIES[0])
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [durationHours, setDurationHours] = useState('3')
  const [mode, setMode] = useState<PlannerMode>('assess')

  const { result, isLoading, error, assess, clearResult } = useActivityRisk()
  const {
    result: bestDateResult,
    isLoading: bestDateLoading,
    error: bestDateError,
    findBestDate,
    clearResult: clearBestDate,
  } = useBestDateFinder()
  const island = useIsland()

  const handleModeSwitch = (next: PlannerMode) => {
    setMode(next)
    clearResult()
    clearBestDate()
  }

  const handleAssess = async () => {
    if (!location) return
    const data = await assess({
      lat: location.lat,
      lon: location.lon,
      activity,
      location_name: location.display_name,
      target_date: targetDate,
      duration_hours: durationHours,
    })
    if (data) {
      island.setState('activity', {
        location: location.display_name,
        temp: 0,
        condition: '',
        risk_level: data.risk_level,
        activity_name: ACTIVITY_LABELS[activity] ?? activity,
        suitability: data.suitability,
      })
    }
  }

  const handleFindBestDate = async () => {
    if (!location) return
    await findBestDate({
      lat: location.lat,
      lon: location.lon,
      activity,
      location_name: location.display_name,
      duration_hours: durationHours,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={cn(
        'bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100 p-6',
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800 text-lg">Activity Planner</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          Assess weather risk for your planned activity
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-slate-100 p-1 mb-4 gap-1">
        {(['assess', 'best-date'] as const).map((m) => (
          <button
            key={m}
            onClick={() => handleModeSwitch(m)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              mode === m
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'best-date' && <CalendarDays size={11} />}
            {m === 'assess' ? 'Assess Risk' : 'Find Best Date'}
          </button>
        ))}
      </div>

      {/* Activity grid */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {SUPPORTED_ACTIVITIES.map((act) => (
          <button
            key={act}
            onClick={() => {
              setActivity(act)
              clearResult()
              clearBestDate()
            }}
            className={`px-2 py-2 rounded-xl text-xs font-medium transition-colors ${
              activity === act
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {ACTIVITY_LABELS[act] ?? act}
          </button>
        ))}
      </div>

      {/* Options */}
      <div className="flex items-end gap-3 mb-4">
        {mode === 'assess' && (
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        )}
        <div className={mode === 'assess' ? 'flex-1' : 'flex-1 max-w-[160px]'}>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Duration (hours)
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        {mode === 'assess' ? (
          <button
            onClick={() => void handleAssess()}
            disabled={!location || isLoading}
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shrink-0 h-[42px]"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Assessing</span>
              </>
            ) : (
              'Assess'
            )}
          </button>
        ) : (
          <button
            onClick={() => void handleFindBestDate()}
            disabled={!location || bestDateLoading}
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2 shrink-0 h-[42px]"
          >
            {bestDateLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Scanning</span>
              </>
            ) : (
              <>
                <CalendarDays size={14} />
                <span>Find</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Error */}
      {(error || bestDateError) && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error ?? bestDateError}
        </div>
      )}

      {/* Results — Assess mode */}
      <AnimatePresence>
        {mode === 'assess' && result && !isLoading && (
          <motion.div
            key="activity-result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Suitability + Risk + Score header */}
            <div className="flex items-center gap-4 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  SUITABILITY_STYLES[result.suitability] ?? SUITABILITY_STYLES.MARGINAL
                }`}
              >
                {result.suitability === 'SUITABLE' ? (
                  <ShieldCheck size={14} />
                ) : (
                  <AlertTriangle size={14} />
                )}
                {result.suitability === 'SUITABLE'
                  ? 'Suitable'
                  : result.suitability === 'MARGINAL'
                    ? 'Marginal'
                    : 'Unsuitable'}
              </span>
              <RiskBadge risk={result.risk_level} />
              <ScoreRing score={100 - result.risk_score} size={40} label="Safety" />
            </div>

            {/* Recommendation */}
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Recommendation</p>
              <p className="text-sm text-blue-800">{result.recommendation}</p>
            </div>

            {/* Best time window */}
            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-4 py-3">
              <Clock size={16} className="text-slate-400" />
              <span className="text-sm text-slate-600">
                Best time: <strong>{result.best_time_window}</strong>
              </span>
            </div>

            {/* Key concerns */}
            {result.key_concerns.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Key Concerns</p>
                <ul className="space-y-1">
                  {result.key_concerns.map((c, i) => (
                    <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Safety tips + Gear suggestions */}
            <div className="grid grid-cols-2 gap-4">
              {result.safety_tips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                    <AlertTriangle size={12} /> Safety Tips
                  </p>
                  <ul className="space-y-1">
                    {result.safety_tips.map((t, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.gear_suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                    <Wrench size={12} /> Gear Suggestions
                  </p>
                  <ul className="space-y-1">
                    {result.gear_suggestions.map((g, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="pt-1">
              <ContractBadge contract="ActivityRisk" />
            </div>

            <AiExplanationPanel
              contractType="activity"
              contractResult={result}
              userQuery={`${ACTIVITY_LABELS[result.activity] ?? result.activity} at ${result.location} on ${result.target_date}`}
            />
          </motion.div>
        )}

        {/* Results — Best Date mode */}
        {mode === 'best-date' && bestDateResult && !bestDateLoading && (
          <motion.div
            key="best-date-result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Best date banner */}
            <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Best Day</p>
              <p className="text-sm text-emerald-800 font-medium">
                {bestDateResult.best_day_name} — {bestDateResult.best_date}
              </p>
              <p className="text-xs text-emerald-600 mt-1">{bestDateResult.reasoning}</p>
            </div>

            {/* 7-day ranking */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500">7-Day Ranking</p>
              {bestDateResult.ranked_dates.map((d: DateRanking) => (
                <div
                  key={d.date}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                    d.rank === 1
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <span className={`text-base font-bold w-6 ${d.rank === 1 ? 'text-emerald-400' : 'text-slate-300'}`}>
                    #{d.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-700">{d.day_name}</p>
                      <span className="text-xs text-slate-400">{d.date}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">{d.condition_summary.slice(0, 60)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RiskBadge risk={d.risk_level} size="sm" />
                    <span className="text-sm font-bold text-blue-500 w-8 text-right">
                      {d.overall_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-1">
              <ContractBadge contract="ActivityRisk" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
