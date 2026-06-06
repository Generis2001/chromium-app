/**
 * Transforms raw Open-Meteo API responses into strongly-typed forecast objects
 * used by the display layer.
 * Final weather decisions come from GenLayer Intelligent Contracts — not here.
 */

import {
  wmoToCondition,
  wmoToDescription,
  wmoToIcon,
  isExtremeCondition,
} from './normalize'

// ─── Raw API shapes ───────────────────────────────────────────────────────────
// Inline to avoid import cycles with open-meteo.ts

interface RawDailyData {
  time: string[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  apparent_temperature_max: number[]
  apparent_temperature_min: number[]
  precipitation_sum: number[]
  rain_sum: number[]
  snowfall_sum: number[]
  precipitation_hours: number[]
  precipitation_probability_max: number[]
  weather_code: number[]
  wind_speed_10m_max: number[]
  wind_gusts_10m_max: number[]
  wind_direction_10m_dominant: number[]
  uv_index_max: number[]
  sunrise: string[]
  sunset: string[]
  daylight_duration: number[]
  sunshine_duration: number[]
}

interface RawHourlyData {
  time: string[]
  temperature_2m: number[]
  apparent_temperature: number[]
  precipitation_probability: number[]
  precipitation: number[]
  weather_code: number[]
  wind_speed_10m: number[]
  wind_gusts_10m: number[]
  visibility: number[]
  relative_humidity_2m: number[]
  uv_index: number[]
  cloud_cover: number[]
}

// ─── Exported types ───────────────────────────────────────────────────────────

export interface DayForecast {
  date: string
  dayOfWeek: string
  isToday: boolean
  isTomorrow: boolean
  tempMaxC: number
  tempMinC: number
  feelsLikeMaxC: number
  feelsLikeMinC: number
  precipSumMm: number
  rainMm: number
  snowMm: number
  precipHours: number
  precipProbabilityPct: number
  weatherCode: number
  condition: string
  description: string
  icon: string
  windMaxKmh: number
  gustsMaxKmh: number
  windDirectionDeg: number
  windDirection: string
  uvIndexMax: number
  sunriseISO: string
  sunsetISO: string
  daylightMinutes: number
  sunshineMinutes: number
  isExtremeDay: boolean
}

export interface HourBlock {
  timeISO: string
  hour: number
  label: string
  tempC: number
  feelsLikeC: number
  precipMm: number
  precipProbabilityPct: number
  weatherCode: number
  condition: string
  icon: string
  windKmh: number
  gustsKmh: number
  visibilityM: number
  humidityPct: number
  uvIndex: number
  cloudCoverPct: number
}

export interface WeekSummary {
  avgTempC: number
  totalPrecipMm: number
  dominantCondition: string
  rainyDays: number
  sunnyDays: number
  extremeDays: number
  temperatureRange: { min: number; max: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a bearing in degrees to the nearest 16-point compass label.
 * Using integer arithmetic avoids floating-point index edge cases.
 */
export function degreesToCompass(degrees: number): string {
  const labels = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW',
  ]
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16
  return labels[index]
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function formatHourLabel(isoTime: string): string {
  const hour = new Date(isoTime).getHours()
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

// ─── Exported functions ───────────────────────────────────────────────────────

export function processDailyForecast(raw: RawDailyData): DayForecast[] {
  const today = todayDateString()
  const tomorrow = tomorrowDateString()

  return raw.time.map((dateStr, i) => {
    const weatherCode = raw.weather_code[i]
    const windDirectionDeg = raw.wind_direction_10m_dominant[i]

    // Open-Meteo daylight_duration and sunshine_duration are in seconds
    const daylightMinutes = Math.round(raw.daylight_duration[i] / 60)
    const sunshineMinutes = Math.round(raw.sunshine_duration[i] / 60)

    const dateObj = new Date(dateStr + 'T12:00:00')

    return {
      date: dateStr,
      dayOfWeek: DAY_NAMES[dateObj.getDay()],
      isToday: dateStr === today,
      isTomorrow: dateStr === tomorrow,
      tempMaxC: raw.temperature_2m_max[i],
      tempMinC: raw.temperature_2m_min[i],
      feelsLikeMaxC: raw.apparent_temperature_max[i],
      feelsLikeMinC: raw.apparent_temperature_min[i],
      precipSumMm: raw.precipitation_sum[i],
      rainMm: raw.rain_sum[i],
      snowMm: raw.snowfall_sum[i],
      precipHours: raw.precipitation_hours[i],
      precipProbabilityPct: raw.precipitation_probability_max[i],
      weatherCode,
      condition: wmoToCondition(weatherCode),
      description: wmoToDescription(weatherCode),
      icon: wmoToIcon(weatherCode, true),
      windMaxKmh: raw.wind_speed_10m_max[i],
      gustsMaxKmh: raw.wind_gusts_10m_max[i],
      windDirectionDeg,
      windDirection: degreesToCompass(windDirectionDeg),
      uvIndexMax: raw.uv_index_max[i],
      sunriseISO: raw.sunrise[i],
      sunsetISO: raw.sunset[i],
      daylightMinutes,
      sunshineMinutes,
      isExtremeDay: isExtremeCondition(weatherCode),
    }
  })
}

export function processHourlyForecast(
  raw: RawHourlyData,
  hours = 48,
): HourBlock[] {
  const now = Date.now()
  const blocks: HourBlock[] = []

  for (let i = 0; i < raw.time.length && blocks.length < hours; i++) {
    const timeISO = raw.time[i]
    const ts = new Date(timeISO).getTime()
    // Skip past hours, include from the current hour onward
    if (ts < now - 60 * 60 * 1000) continue

    const weatherCode = raw.weather_code[i]
    const hour = new Date(timeISO).getHours()

    blocks.push({
      timeISO,
      hour,
      label: formatHourLabel(timeISO),
      tempC: raw.temperature_2m[i],
      feelsLikeC: raw.apparent_temperature[i],
      precipMm: raw.precipitation[i],
      precipProbabilityPct: raw.precipitation_probability[i],
      weatherCode,
      condition: wmoToCondition(weatherCode),
      icon: wmoToIcon(weatherCode, hour >= 6 && hour < 20),
      windKmh: raw.wind_speed_10m[i],
      gustsKmh: raw.wind_gusts_10m[i],
      visibilityM: raw.visibility[i],
      humidityPct: raw.relative_humidity_2m[i],
      uvIndex: raw.uv_index[i],
      cloudCoverPct: raw.cloud_cover[i],
    })
  }

  return blocks
}

/**
 * Returns the 0-based index into `days` of the best day for the given criteria.
 *
 * Scoring rationale:
 * - comfort/outdoor: minimise precipitation probability and extreme conditions,
 *   reward UV for outdoor/photography while staying moderate.
 * - travel: prioritise visibility (no heavy precip, no extreme wind).
 * - photography: reward golden-hour potential (long sunshine, moderate UV),
 *   penalise extreme conditions heavily.
 */
export function findBestDay(
  days: DayForecast[],
  criteria: 'comfort' | 'outdoor' | 'travel' | 'photography',
): number {
  if (days.length === 0) return 0

  const scores = days.map((day) => {
    if (day.isExtremeDay) return -Infinity

    const precipPenalty = day.precipProbabilityPct * 0.5 + day.precipSumMm * 2
    const windPenalty = Math.max(0, day.windMaxKmh - 30) * 0.4
    const tempMid = (day.tempMaxC + day.tempMinC) / 2
    // Comfort optimum at 21 °C
    const tempPenalty = Math.abs(tempMid - 21) * 0.8

    switch (criteria) {
      case 'comfort':
        return 100 - precipPenalty - windPenalty - tempPenalty

      case 'outdoor':
        return (
          100 -
          precipPenalty * 1.2 -
          windPenalty -
          tempPenalty +
          day.sunshineMinutes * 0.02
        )

      case 'travel': {
        // Heavy precipitation and strong gusts hurt travel most
        const gustPenalty = Math.max(0, day.gustsMaxKmh - 40) * 0.5
        return 100 - precipPenalty * 1.5 - gustPenalty - tempPenalty * 0.5
      }

      case 'photography': {
        // Soft light: partial cloud is fine; reward sunshine duration, penalise full overcast
        const cloudBonus = day.sunshineMinutes > 60 ? day.sunshineMinutes * 0.03 : 0
        const uvPenalty = day.uvIndexMax > 8 ? (day.uvIndexMax - 8) * 3 : 0
        return 100 - precipPenalty * 1.3 - windPenalty - uvPenalty + cloudBonus
      }
    }
  })

  let bestIdx = 0
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[bestIdx]) bestIdx = i
  }
  return bestIdx
}

export function summariseWeek(days: DayForecast[]): WeekSummary {
  if (days.length === 0) {
    return {
      avgTempC: 0,
      totalPrecipMm: 0,
      dominantCondition: 'unknown',
      rainyDays: 0,
      sunnyDays: 0,
      extremeDays: 0,
      temperatureRange: { min: 0, max: 0 },
    }
  }

  let sumTemp = 0
  let totalPrecipMm = 0
  let rainyDays = 0
  let sunnyDays = 0
  let extremeDays = 0
  let minTemp = Infinity
  let maxTemp = -Infinity
  const conditionCounts: Record<string, number> = {}

  for (const day of days) {
    const midTemp = (day.tempMaxC + day.tempMinC) / 2
    sumTemp += midTemp

    if (day.tempMaxC > maxTemp) maxTemp = day.tempMaxC
    if (day.tempMinC < minTemp) minTemp = day.tempMinC

    totalPrecipMm += day.precipSumMm

    if (day.precipProbabilityPct >= 50 || day.precipSumMm >= 1) rainyDays++
    // Sunny: low cloud implied by long sunshine relative to daylight
    if (day.daylightMinutes > 0 && day.sunshineMinutes / day.daylightMinutes >= 0.6) {
      sunnyDays++
    }
    if (day.isExtremeDay) extremeDays++

    const cond = day.condition
    conditionCounts[cond] = (conditionCounts[cond] ?? 0) + 1
  }

  const dominantCondition = Object.entries(conditionCounts).reduce(
    (best, [cond, count]) => (count > best[1] ? [cond, count] : best),
    ['unknown', 0] as [string, number],
  )[0]

  return {
    avgTempC: Math.round((sumTemp / days.length) * 10) / 10,
    totalPrecipMm: Math.round(totalPrecipMm * 10) / 10,
    dominantCondition,
    rainyDays,
    sunnyDays,
    extremeDays,
    temperatureRange: { min: minTemp, max: maxTemp },
  }
}
