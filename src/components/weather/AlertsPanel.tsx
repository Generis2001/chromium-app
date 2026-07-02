'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, AlertTriangle, Clock, Eye, ShieldCheck } from 'lucide-react'
import { useClientWeatherAlerts } from '@/hooks/useClientContract'
import { ContractBadge } from '@/components/weather/ContractBadge'
import { AiExplanationPanel } from '@/components/weather/AiExplanationPanel'
import { cn } from '@/lib/utils'
import type { GeocodingResult, WeatherAlert } from '@/types'

type AlertsPanelProps = {
  location: GeocodingResult | null
  walletAddress: string | null
  className?: string
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  thunderstorm: 'Thunderstorm',
  heavy_precipitation: 'Heavy Precipitation',
  extreme_heat: 'Extreme Heat',
  extreme_cold: 'Extreme Cold',
  high_wind: 'High Wind',
  dense_fog: 'Dense Fog',
  heavy_snow: 'Heavy Snow',
  extreme_uv: 'Extreme UV',
  rapid_pressure_drop: 'Rapid Pressure Drop',
}

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  WATCH: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  WARNING: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-400' },
  EMERGENCY: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    dot: 'bg-red-500',
  },
}

const LOOKAHEAD_OPTIONS = [
  { value: '6', label: '6 hours' },
  { value: '12', label: '12 hours' },
  { value: '24', label: '24 hours' },
  { value: '48', label: '48 hours' },
] as const

export function AlertsPanel({ location, walletAddress, className }: AlertsPanelProps) {
  const [lookaheadHours, setLookaheadHours] = useState('12')

  const { result, isLoading, txHash, error, checkAlerts, clearResult } = useClientWeatherAlerts(walletAddress)

  const handleCheck = async () => {
    if (!location) return
    await checkAlerts({
      lat: location.lat,
      lon: location.lon,
      location_name: location.display_name,
      lookahead_hours: lookaheadHours,
    })
  }

  const overallColor = result
    ? result.overall_severity === 'EMERGENCY'
      ? 'text-red-600'
      : result.overall_severity === 'WARNING'
        ? 'text-orange-600'
        : result.overall_severity === 'WATCH'
          ? 'text-amber-600'
          : 'text-emerald-600'
    : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
      className={cn(
        'bg-white rounded-lg shadow-[0_8px_32px_rgba(15,23,42,0.08)] border border-slate-300 p-4 sm:p-6',
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="font-semibold text-slate-800 text-lg">Weather Alerts</h2>
        <p className="text-slate-400 text-sm mt-0.5">
          AI-powered alert detection for your area
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Lookahead Period
          </label>
          <select
            value={lookaheadHours}
            onChange={(e) => {
              setLookaheadHours(e.target.value)
              clearResult()
            }}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            {LOOKAHEAD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => void handleCheck()}
          disabled={!location || isLoading || !walletAddress}
          className="h-[42px] justify-center px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Checking</span>
            </>
          ) : (
            'Check Alerts'
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tx hash while waiting */}
      {txHash && isLoading && (
        <p className="mb-3 text-[11px] text-slate-400 font-mono truncate">
          Tx: {txHash.slice(0, 12)}…{txHash.slice(-8)}
        </p>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && !isLoading && (
          <motion.div
            key="alerts-result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            {/* Summary row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`text-lg font-bold ${overallColor}`}>
                  {result.overall_severity === 'NONE'
                    ? 'All Clear'
                    : result.overall_severity}
                </span>
                {result.alert_count > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                    {result.alert_count} alert{result.alert_count !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <ContractBadge contract="WeatherAlert" />
            </div>

            {/* Summary text */}
            <p className="text-sm text-slate-600 break-words">{result.summary}</p>

            {/* Alert cards */}
            {result.alerts.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500">Active Alerts</p>
                {result.alerts.map((alert: WeatherAlert) => {
                  const colors = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.WATCH
                  return (
                    <div
                      key={alert.id}
                      className={`rounded-lg ${colors.bg} border ${colors.border} p-4 space-y-2`}
                    >
                      {/* Alert header */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className={`size-2 rounded-full ${colors.dot} shrink-0`} />
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold break-words ${colors.text}`}>
                              {alert.title}
                            </p>
                            <p className="text-xs text-slate-500 break-words">
                              {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}
                        >
                          {alert.severity}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 leading-relaxed break-words">
                        {alert.description}
                      </p>

                      {/* Details row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 pt-1">
                        {alert.peak_value > 0 && (
                          <span className="flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Peak: {alert.peak_value}
                          </span>
                        )}
                        {alert.expires_hours > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            Expires ~{alert.expires_hours}h
                          </span>
                        )}
                        {alert.affected_hours.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye size={12} />
                            {alert.affected_hours.length}h affected
                          </span>
                        )}
                      </div>

                      {/* Safety actions */}
                      {alert.safety_actions.length > 0 && (
                        <div className="pt-1">
                          <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                            Recommended Actions
                          </p>
                          <ul className="space-y-0.5">
                            {alert.safety_actions.map((action, i) => (
                              <li
                                key={i}
                                className="text-xs text-slate-600 flex items-start gap-1.5"
                              >
                                <span className="text-blue-400 mt-0.5">•</span>
                                <span className="min-w-0 break-words">{action}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* No alerts */}
            {result.alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <ShieldCheck size={24} className="text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-slate-600">No active alerts</p>
                <p className="text-xs text-slate-400 mt-1">
                  Conditions look safe for the next {lookaheadHours} hours
                </p>
              </div>
            )}

            <AiExplanationPanel
              contractType="alerts"
              contractResult={result}
              userQuery={`Alerts for ${result.location} in next ${lookaheadHours}h`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
