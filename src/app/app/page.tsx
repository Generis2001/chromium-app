'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { CloudSun, Map, Activity, Bell, LogOut } from 'lucide-react'
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
import { useWallet } from '@/hooks/useWallet'
import type { GeocodingResult } from '@/types'

type TabId = 'weather' | 'compare' | 'activities' | 'alerts'

function App() {
  const router = useRouter()
  const { location, setLocation, recentLocations, clearRecentLocations, isDetecting, error: locationError } = useLocation()
  const [activeTab, setActiveTab] = useState<TabId>('weather')
  const { address: walletAddress, disconnect } = useWallet()

  const handleExit = useCallback(async () => {
    await disconnect()
    router.push('/')
  }, [disconnect, router])

  const handleLocationSelect = useCallback(
    (geo: GeocodingResult) => { setLocation(geo) },
    [setLocation],
  )

  return (
    <IslandProvider>
      <DynamicIsland />

      {/* Exit button — top right, always visible */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => void handleExit()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 text-xs font-medium transition-colors shadow-sm"
        >
          <LogOut size={13} />
          Exit Chromium
        </button>
      </div>

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
          <TabsList className="w-full max-w-md mx-auto grid grid-cols-4 mb-8 rounded-lg bg-white/90 dark:bg-[rgba(6,20,40,0.9)] backdrop-blur-sm border border-slate-300 dark:border-[rgba(14,165,233,0.28)] p-1 shadow-sm overflow-hidden">
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
                  className="flex min-w-0 items-center justify-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-[rgba(14,165,233,0.18)] dark:data-[state=active]:shadow-[0_0_14px_rgba(14,165,233,0.25)] data-[state=active]:text-white dark:data-[state=active]:text-cyan-300 data-[state=active]:shadow-sm text-slate-500 dark:text-[#3d6880] transition-all sm:gap-1.5 sm:text-xs"
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ─── Tab: Weather ─── */}
            <TabsContent value="weather" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                  <WeatherDecisionEngine location={location} walletAddress={walletAddress} />
                </div>
                <div className="lg:col-span-2">
                  {location ? (
                    <CurrentConditionsCard
                      lat={location.lat}
                      lon={location.lon}
                      locationName={location.display_name}
                    />
                  ) : (
                    <div className="bg-white dark:bg-[rgba(6,20,40,0.97)] rounded-lg border border-slate-300 dark:border-[rgba(14,165,233,0.22)] p-6 flex flex-col items-center justify-center min-h-40 text-center text-slate-400 dark:text-[#3d6880] shadow-sm">
                      <p className="text-sm">Select a location to see current conditions</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ─── Tab: Compare ─── */}
            <TabsContent value="compare" className="mt-0">
              <MultiLocationComparison walletAddress={walletAddress} />
            </TabsContent>

            {/* ─── Tab: Activities ─── */}
            <TabsContent value="activities" className="mt-0">
              <ActivityPlanner location={location} walletAddress={walletAddress} />
            </TabsContent>

            {/* ─── Tab: Alerts ─── */}
            <TabsContent value="alerts" className="mt-0">
              <AlertsPanel location={location} walletAddress={walletAddress} />
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
