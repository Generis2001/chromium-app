'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CloudSun, Map, Activity, Bell } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { IslandProvider } from '@/components/dynamic-island'
import { DynamicIsland } from '@/components/dynamic-island'
import { LocationSearch } from '@/components/weather/LocationSearch'
import { WeatherDecisionEngine } from '@/components/weather/WeatherDecisionEngine'
import { CurrentConditionsCard } from '@/components/weather/CurrentConditionsCard'
import { MultiLocationComparison } from '@/components/weather/MultiLocationComparison'
import { ActivityPlanner } from '@/components/weather/ActivityPlanner'
import { AlertsPanel } from '@/components/weather/AlertsPanel'
import { RecentLocationsBar } from '@/components/weather/RecentLocationsBar'
import { useLocation } from '@/hooks/useLocation'
import type { GeocodingResult } from '@/types'

const TAB_ICONS = {
  weather: CloudSun,
  compare: Map,
  activities: Activity,
  alerts: Bell,
} as const

type TabId = keyof typeof TAB_ICONS

function App() {
  const { location, setLocation, recentLocations, clearRecentLocations } = useLocation()
  const [activeTab, setActiveTab] = useState<TabId>('weather')

  const handleLocationSelect = useCallback(
    (geo: GeocodingResult) => {
      setLocation(geo)
    },
    [setLocation],
  )

  return (
    <IslandProvider>
      {/* Dynamic Island pill — fixed floating */}
      <DynamicIsland />

      {/* Main content */}
      <div className="min-h-screen bg-[#F0F4FF]">
        <div className="max-w-6xl mx-auto px-4 pt-24 pb-24">
          {/* ─── Header ─── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
              Chromium
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              AI Weather Intelligence powered by GenLayer
            </p>
          </motion.div>

          {/* ─── Location Search ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="max-w-xl mx-auto mb-8"
          >
            <LocationSearch
              onSelect={handleLocationSelect}
              placeholder="Search for a city or location..."
              autoFocus
            />
            {location && (
              <p className="text-xs text-slate-400 text-center mt-2">
                Current location: {location.display_name}
              </p>
            )}
            {recentLocations.length > 0 && (
              <RecentLocationsBar
                locations={recentLocations}
                onSelect={handleLocationSelect}
                onClear={clearRecentLocations}
                className="mt-3 justify-center"
              />
            )}
          </motion.div>

          {/* ─── Tabs ─── */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabId)}
            className="w-full"
          >
            <TabsList className="w-full max-w-md mx-auto grid grid-cols-4 mb-8 rounded-2xl bg-white/70 backdrop-blur-sm border border-slate-200/60 p-1">
              {(
                [
                  { id: 'weather', label: 'Weather', icon: CloudSun },
                  { id: 'compare', label: 'Compare', icon: Map },
                  { id: 'activities', label: 'Activities', icon: Activity },
                  { id: 'alerts', label: 'Alerts', icon: Bell },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex items-center gap-1.5 rounded-xl py-2 text-xs font-medium data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm text-slate-500 transition-all"
                >
                  <Icon size={14} />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ─── Tab: Weather ─── */}
            <TabsContent value="weather" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <WeatherDecisionEngine location={location} />
                </div>
                <div className="lg:col-span-2">
                  {location && (
                    <CurrentConditionsCard
                      lat={location.lat}
                      lon={location.lon}
                      locationName={location.display_name}
                    />
                  )}
                  {!location && (
                    <div className="bg-white rounded-[20px] border border-slate-100 p-6 flex flex-col items-center justify-center h-40 text-slate-400">
                      <p className="text-sm">Select a location to see current conditions</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── Tab: Compare ─── */}
            <TabsContent value="compare" className="mt-0">
              <MultiLocationComparison />
            </TabsContent>

            {/* ─── Tab: Activities ─── */}
            <TabsContent value="activities" className="mt-0">
              <ActivityPlanner location={location} />
            </TabsContent>

            {/* ─── Tab: Alerts ─── */}
            <TabsContent value="alerts" className="mt-0">
              <AlertsPanel location={location} />
            </TabsContent>
          </Tabs>

          {/* ─── Footer ─── */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs text-slate-300 mt-12 pb-4"
          >
            Decisions powered by GenLayer Intelligent Contracts on testnetBradbury
          </motion.p>
        </div>
      </div>
    </IslandProvider>
  )
}

export default App
