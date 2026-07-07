'use client'

import { motion } from 'framer-motion'
import { Wind, Droplets, Eye, Sun, RefreshCw } from 'lucide-react'
import { useWeather } from '@/hooks/useWeather'
import { wmoToIcon, wmoToDescription } from '@/lib/weather/normalize'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type CurrentConditionsCardProps = {
  lat: string
  lon: string
  locationName: string
  className?: string
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes === 1) return '1 min ago'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function CurrentConditionsCard({
  lat,
  lon,
  locationName,
  className,
}: CurrentConditionsCardProps) {
  const { current, isLoading, isRefreshing, error, lastUpdated, refresh } = useWeather(lat, lon)

  const shortName = locationName.split(',')[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'bg-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-slate-100 p-6',
        className
      )}
    >
      {isLoading && !current ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-36" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      ) : current ? (
        <div className="space-y-4">
          {/* Location + refresh */}
          <div className="flex items-start justify-between">
            <h2 className="font-semibold text-slate-800 text-lg leading-tight truncate max-w-[200px]">
              {shortName}
            </h2>
            <button
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title={isRefreshing ? 'Refreshing' : 'Refresh'}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : undefined} />
            </button>
          </div>

          {/* Main temp + condition */}
          <div className="flex items-center gap-4">
            <span className="text-5xl" aria-hidden="true">
              {wmoToIcon(current.weatherCode, current.isDay)}
            </span>
            <div>
              <div className="flex items-end gap-1">
                <span className="text-5xl font-bold text-slate-800 leading-none">
                  {Math.round(current.tempC)}°
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-0.5">
                {wmoToDescription(current.weatherCode)}
              </p>
              <p className="text-slate-400 text-xs">
                Feels like {Math.round(current.feelsLikeC)}°
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              {
                icon: <Wind size={16} className="text-blue-400" />,
                value: `${Math.round(current.windKmh)}`,
                unit: 'km/h',
                label: 'Wind',
              },
              {
                icon: <Droplets size={16} className="text-cyan-400" />,
                value: `${current.humidityPct}`,
                unit: '%',
                label: 'Humidity',
              },
              {
                icon: <Eye size={16} className="text-slate-400" />,
                value: current.visibilityM >= 1000
                  ? `${(current.visibilityM / 1000).toFixed(0)}`
                  : `${current.visibilityM}`,
                unit: current.visibilityM >= 1000 ? 'km' : 'm',
                label: 'Visibility',
              },
              {
                icon: <Sun size={16} className="text-amber-400" />,
                value: `UV`,
                unit: `${Math.round(current.uvIndex)}`,
                label: 'UV Index',
              },
            ].map(({ icon, value, unit, label }) => (
              <div
                key={label}
                className="bg-slate-50 rounded-xl p-2.5 flex flex-col items-center gap-1.5"
              >
                {icon}
                <div className="text-center">
                  <span className="text-sm font-semibold text-slate-700 leading-none">
                    {value}
                  </span>
                  <span className="text-[10px] text-slate-400 ml-0.5">{unit}</span>
                </div>
                <span className="text-[10px] text-slate-400 leading-none">{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="text-[11px] text-amber-600">
              Refresh failed. Showing the last successful weather update.
            </p>
          )}

          {/* Last updated */}
          {lastUpdated && (
            <p className="text-right text-[11px] text-slate-400">
              Updated {timeAgo(lastUpdated)}
            </p>
          )}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-40 text-slate-400">
          <p className="text-sm">Failed to load weather</p>
          <button
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1"
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : undefined} /> Retry
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}
