'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GeocodingResult } from '@/types'

type RecentLocationsBarProps = {
  locations: GeocodingResult[]
  onSelect: (loc: GeocodingResult) => void
  onClear: () => void
  className?: string
}

export function RecentLocationsBar({
  locations,
  onSelect,
  onClear,
  className,
}: RecentLocationsBarProps) {
  if (locations.length === 0) return null

  return (
    <AnimatePresence>
      <motion.div
        key="recent-bar"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className={cn('flex items-center gap-2 flex-wrap', className)}
      >
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0">
          <Clock size={11} />
          Recent
        </span>

        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {locations.map((loc) => (
            <button
              key={`${loc.lat}:${loc.lon}`}
              onClick={() => onSelect(loc)}
              className="
                px-3 py-1 rounded-full text-[11px] font-medium
                bg-white/60 dark:bg-[rgba(6,20,40,0.8)] backdrop-blur-sm
                border border-white/80 dark:border-[rgba(14,165,233,0.2)]
                text-slate-600 dark:text-[#7ab8cc]
                hover:text-blue-600 dark:hover:text-cyan-300
                hover:border-blue-300 dark:hover:border-[rgba(14,165,233,0.4)]
                hover:bg-blue-50/60 dark:hover:bg-[rgba(14,165,233,0.08)]
                shadow-sm transition-all truncate max-w-[140px]
              "
              title={loc.display_name}
            >
              {loc.name || loc.display_name.split(',')[0]}
            </button>
          ))}
        </div>

        <button
          onClick={onClear}
          className="size-6 rounded-full flex items-center justify-center text-slate-300 dark:text-[#2a4f62] hover:text-slate-500 dark:hover:text-[#3d6880] hover:bg-slate-100 dark:hover:bg-[rgba(14,165,233,0.08)] transition-colors shrink-0"
          title="Clear recent locations"
          aria-label="Clear recent locations"
        >
          <X size={11} />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
