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

type TabId = 'weather' | 'compare' | 'activities' | 'alerts'

function App() {
  const { location, setLocation, recentLocations, clearRecentLocations, isDetecting, error: locationError } = useLocation()
  const [activeTab, setActiveTab] = useState<TabId>('weather')

  const handleLocationSelect = useCallback(
    (geo: GeocodingResult) => { setLocation(geo) },
    [setLocation],
  )

  return (
    <IslandProvider>
      <DynamicIsland />

      <div className="min-h-screen bg-[#F0F4FF] dark:bg-transparent">
        <div className="max-w-6xl mx-auto px-4 pt-24 pb-24">

          {/* ─── Header ─── */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Chromium</h1>
            <p className="text-sm text-slate-400 dark:text-cyan-500/60 mt-1">
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
            {isDetecting && !location && (
              <p className="text-xs text-slate-400 text-center mt-2 animate-pulse">
                Detecting your location…
              </p>
            )}
            {locationError && !location && (
              <p className="text-xs text-red-400 text-center mt-2">{locationError}</p>
            )}
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
            <TabsList className="w-full max-w-md mx-auto grid grid-cols-4 mb-8 rounded-2xl bg-white/70 dark:bg-[rgba(6,20,40,0.82)] backdrop-blur-sm border border-slate-200/60 dark:border-[rgba(14,165,233,0.2)] p-1">
              {(
                [
                  { id: 'weather', label: 'Weather', icon: CloudSun, fee: '0.5 GEN' },
                  { id: 'compare', label: 'Compare', icon: Map, fee: '1 GEN' },
                  { id: 'activities', label: 'Activities', icon: Activity, fee: '0.5 GEN' },
                  { id: 'alerts', label: 'Alerts', icon: Bell, fee: '0.5 GEN' },
                ] as const
              ).map(({ id, label, icon: Icon, fee }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-[rgba(14,165,233,0.18)] dark:data-[state=active]:shadow-[0_0_14px_rgba(14,165,233,0.25)] data-[state=active]:text-white dark:data-[state=active]:text-cyan-300 data-[state=active]:shadow-sm text-slate-500 dark:text-[#3d6880] transition-all"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon size={14} />
                    {label}
                  </span>
                  <span className="text-[9px] font-semibold opacity-60 leading-none">{fee}</span>
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
                  {location ? (
                    <CurrentConditionsCard
                      lat={location.lat}
                      lon={location.lon}
                      locationName={location.display_name}
                    />
                  ) : (
                    <div className="bg-white dark:bg-[rgba(6,20,40,0.97)] rounded-[20px] border border-slate-100 dark:border-[rgba(14,165,233,0.14)] p-6 flex flex-col items-center justify-center h-40 text-slate-400 dark:text-[#3d6880]">
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
            className="text-center text-xs text-slate-300 dark:text-[rgba(14,165,233,0.35)] mt-12 pb-4"
          >
            Decisions powered by GenLayer Intelligent Contracts on studionet
          </motion.p>
        </div>
      </div>
    </IslandProvider>
  )
}

export default App
