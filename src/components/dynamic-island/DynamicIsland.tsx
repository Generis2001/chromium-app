'use client'

import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useIsland } from './useIsland'
import { RiskBadge } from '@/components/ui/RiskBadge'
import { DecisionBadge } from '@/components/ui/DecisionBadge'
import { ScoreRing } from '@/components/ui/ScoreRing'

// ─── Types ────────────────────────────────────────────────────────────────────

type DynamicIslandProps = {
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function conditionToEmoji(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes('thunder') || c.includes('storm')) return '⛈️'
  if (c.includes('snow') || c.includes('blizzard')) return '❄️'
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️'
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️'
  if (c.includes('cloud') && c.includes('partly')) return '⛅'
  if (c.includes('cloud') || c.includes('overcast')) return '☁️'
  if (c.includes('wind')) return '💨'
  if (c.includes('clear') || c.includes('sunny')) return '☀️'
  return '🌤️'
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// Spring physics shared across shape morphs
const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const

// ─── Sub-components (content for each state) ─────────────────────────────────

function IdleContent() {
  return (
    <motion.div
      key="idle"
      className="flex items-center gap-2 px-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Pulsing blue dot */}
      <motion.span
        className="size-2 rounded-full bg-blue-400"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      />
      <span className="text-xs font-medium tracking-wide text-white/80">Chromium</span>
    </motion.div>
  )
}

function LoadingContent() {
  const dots = [0, 1, 2]
  return (
    <motion.div
      key="loading"
      className="flex items-center gap-2.5 px-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center gap-1">
        {dots.map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-white/60"
            animate={{ y: [0, -4, 0] }}
            transition={{
              repeat: Infinity,
              duration: 0.7,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-white/70">Analyzing conditions…</span>
    </motion.div>
  )
}

function WeatherContent({
  data,
  onExpand,
}: {
  data: NonNullable<ReturnType<typeof useIsland>['data']>
  onExpand: () => void
}) {
  return (
    <motion.button
      key="weather"
      className="flex items-center gap-2 px-3 cursor-pointer hover:opacity-90 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onExpand}
      type="button"
    >
      <span className="text-base leading-none">{conditionToEmoji(data.condition)}</span>
      <span className="text-sm font-semibold text-white tabular-nums">{data.temp}°C</span>
      <span className="text-xs text-white/70 font-medium">{truncate(data.location, 16)}</span>
      <RiskBadge risk={data.risk_level} size="sm" />
      <span className="ml-auto text-white/40 text-xs">▼</span>
    </motion.button>
  )
}

function AlertContent({
  data,
  onExpand,
}: {
  data: NonNullable<ReturnType<typeof useIsland>['data']>
  onExpand: () => void
}) {
  const alertCount = data.alerts?.length ?? 0
  const severity = data.alerts?.[0]?.severity ?? 'WATCH'

  const severityColor =
    severity === 'EMERGENCY'
      ? '#EF4444'
      : severity === 'WARNING'
        ? '#F97316'
        : '#EAB308'

  return (
    <motion.button
      key="alert"
      className="flex items-center gap-2 px-3 cursor-pointer hover:opacity-90 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onExpand}
      type="button"
    >
      {/* Pulsing alert dot */}
      <motion.span
        className="size-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: severityColor }}
        animate={{ opacity: [1, 0.2, 1], scale: [1, 1.3, 1] }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
      />
      <span className="text-xs font-semibold text-white">
        {alertCount} Alert{alertCount !== 1 ? 's' : ''}
      </span>
      <span
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: severityColor }}
      >
        {severity}
      </span>
      <span className="ml-auto text-white/40 text-xs">▼</span>
    </motion.button>
  )
}

function ActivityContent({
  data,
  onExpand,
}: {
  data: NonNullable<ReturnType<typeof useIsland>['data']>
  onExpand: () => void
}) {
  const suitabilityColor =
    data.suitability === 'SUITABLE'
      ? '#10B981'
      : data.suitability === 'MARGINAL'
        ? '#F59E0B'
        : '#EF4444'

  return (
    <motion.button
      key="activity"
      className="flex items-center gap-2 px-3 cursor-pointer hover:opacity-90 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onExpand}
      type="button"
    >
      <span className="text-base leading-none">🏃</span>
      <span className="text-xs font-semibold text-white truncate flex-1 text-left">
        {data.activity_name ?? 'Activity'}
      </span>
      <span
        className="text-[10px] font-bold uppercase tracking-wider shrink-0"
        style={{ color: suitabilityColor }}
      >
        {data.suitability ?? 'CHECKING'}
      </span>
      <span className="ml-1 text-white/40 text-xs">▼</span>
    </motion.button>
  )
}

function ComparisonContent({
  data,
  onExpand,
}: {
  data: NonNullable<ReturnType<typeof useIsland>['data']>
  onExpand: () => void
}) {
  return (
    <motion.button
      key="comparison"
      className="flex items-center gap-2 px-3 cursor-pointer hover:opacity-90 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onExpand}
      type="button"
    >
      <span className="text-base leading-none">📍</span>
      <div className="flex flex-col items-start flex-1 min-w-0">
        <span className="text-[10px] text-white/50 uppercase tracking-wider">Best</span>
        <span className="text-xs font-semibold text-white truncate w-full text-left">
          {data.best_location ? truncate(data.best_location, 18) : '-'}
        </span>
      </div>
      {data.comparison_count !== undefined && (
        <span className="text-[10px] text-white/50 shrink-0">
          {data.comparison_count} locations
        </span>
      )}
      <span className="ml-1 text-white/40 text-xs">▼</span>
    </motion.button>
  )
}

function ExpandedContent({
  data,
  onCollapse,
}: {
  data: NonNullable<ReturnType<typeof useIsland>['data']>
  onCollapse: () => void
}) {
  return (
    <motion.div
      key="expanded"
      className="flex flex-col gap-4 p-5 w-full"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-white/50 text-[10px] font-medium uppercase tracking-wider">
            Weather Intelligence
          </span>
          <span className="text-white font-semibold text-sm leading-tight">
            {data.location}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-2xl leading-none">{conditionToEmoji(data.condition)}</span>
            <span className="text-white text-xl font-bold tabular-nums">{data.temp}°C</span>
            <span className="text-white/60 text-xs capitalize">{data.condition}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.confidence !== undefined && (
            <ScoreRing score={data.confidence} size={44} />
          )}
          <button
            onClick={onCollapse}
            type="button"
            className="size-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <X className="size-3.5 text-white/80" />
          </button>
        </div>
      </div>

      {/* Decision block */}
      {data.decision && (
        <div className="rounded-xl bg-white/[0.06] border border-white/[0.08] p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <DecisionBadge decision={data.decision} />
            {data.confidence !== undefined && (
              <span className="text-white/50 text-xs">
                Confidence: <span className="text-white/80 font-medium">{data.confidence}%</span>
              </span>
            )}
          </div>
          {data.reasoning && (
            <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{data.reasoning}</p>
          )}
        </div>
      )}

      {/* Risk level */}
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs uppercase tracking-wider">Risk</span>
        <RiskBadge risk={data.risk_level} size="sm" />
      </div>

      {/* Alerts list */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
            Active Alerts
          </span>
          {data.alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2"
            >
              <span className="text-red-400 text-xs font-bold uppercase tracking-wide flex-shrink-0">
                {alert.severity}
              </span>
              <span className="text-white/70 text-xs leading-tight">{alert.title}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DynamicIsland({ className }: DynamicIslandProps) {
  const { state, data, expand, collapse } = useIsland()

  // Determine pill dimensions per state
  const isExpanded = state === 'expanded'
  const isAlert = state === 'alert'

  const width =
    state === 'idle'
      ? 180
      : state === 'loading'
        ? 240
        : state === 'weather'
          ? 320
          : state === 'alert'
            ? 280
            : state === 'activity'
              ? 300
              : state === 'comparison'
                ? 320
                : 380 // expanded

  const height =
    state === 'expanded'
      ? undefined // let content determine height, min-height set below
      : state === 'weather' || state === 'alert' || state === 'activity' || state === 'comparison'
        ? 44
        : 36

  const borderRadius = isExpanded ? 28 : 100

  // Alert glow style
  const alertGlow = isAlert
    ? {
        boxShadow:
          '0 0 0 2px #EF4444, 0 0 20px rgba(239, 68, 68, 0.4)',
      }
    : {}

  return (
    <LayoutGroup id="dynamic-island">
      <motion.div
        layout
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-[#0A0A0A] overflow-hidden flex items-center ${className ?? ''}`}
        style={{
          width,
          height: isExpanded ? undefined : height,
          minHeight: isExpanded ? 280 : undefined,
          borderRadius,
          ...alertGlow,
        }}
        animate={{
          width,
          borderRadius,
          height: isExpanded ? undefined : height,
        }}
        transition={SPRING}
      >
        <AnimatePresence mode="wait">
          {state === 'idle' && <IdleContent />}
          {state === 'loading' && <LoadingContent />}
          {state === 'weather' && data && (
            <WeatherContent data={data} onExpand={expand} />
          )}
          {state === 'alert' && data && (
            <AlertContent data={data} onExpand={expand} />
          )}
          {state === 'activity' && data && (
            <ActivityContent data={data} onExpand={expand} />
          )}
          {state === 'comparison' && data && (
            <ComparisonContent data={data} onExpand={expand} />
          )}
          {state === 'expanded' && data && (
            <ExpandedContent data={data} onCollapse={collapse} />
          )}
        </AnimatePresence>
      </motion.div>
    </LayoutGroup>
  )
}
