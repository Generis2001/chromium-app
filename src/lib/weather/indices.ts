/**
 * Weather comfort and physiological indices — display-layer only.
 * These are UI visualisation helpers; final weather decisions come from
 * GenLayer Intelligent Contracts.
 */

export interface ComfortParams {
  tempC: number
  feelsLikeC: number
  windKmh: number
  precipMm: number
  humidityPct: number
  visibilityM: number
  uvIndex: number
  weatherCode: number
}

/**
 * Rothfusz regression heat index.
 * Valid only when temp > 27 °C and relative humidity > 40 %.
 * Returns null outside its valid domain.
 */
export function computeHeatIndex(
  tempC: number,
  humidityPct: number,
): number | null {
  if (tempC < 27 || humidityPct < 40) return null

  const T = (tempC * 9) / 5 + 32
  const RH = humidityPct

  const HI =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH

  // Steadman simple formula adjustments for extreme RH edges
  if (RH < 13 && T >= 80 && T <= 112) {
    return ((HI - ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17)) - 32) * (5 / 9)
  }
  if (RH > 85 && T >= 80 && T <= 87) {
    return ((HI + ((RH - 85) / 10) * ((87 - T) / 5)) - 32) * (5 / 9)
  }

  return (HI - 32) * (5 / 9)
}

/**
 * Environment Canada wind chill formula.
 * Valid when temp < 10 °C and wind speed > 4.8 km/h.
 * Returns null outside its valid domain.
 */
export function computeWindChill(
  tempC: number,
  windKmh: number,
): number | null {
  if (tempC >= 10 || windKmh <= 4.8) return null

  return (
    13.12 +
    0.6215 * tempC -
    11.37 * Math.pow(windKmh, 0.16) +
    0.3965 * tempC * Math.pow(windKmh, 0.16)
  )
}

/**
 * Canadian Meteorological Service humidex.
 * Based on dew point rather than relative humidity.
 */
export function computeHumidex(tempC: number, dewPointC: number): number {
  // Clausius-Clapeyron approximation for vapour pressure
  const e = 6.112 * Math.exp((17.67 * dewPointC) / (dewPointC + 243.5))
  return tempC + 0.5555 * (e - 10)
}

/**
 * Australian Bureau of Meteorology apparent temperature.
 * Unlike heat index / wind chill this formula is valid across all conditions
 * and unifies both the cooling effect of wind and the warming effect of humidity.
 * Optional solar radiation (W/m²) accounts for direct sunlight load.
 */
export function computeApparentTemp(
  tempC: number,
  humidityPct: number,
  windKmh: number,
  solarRadiation = 0,
): number {
  const windMs = windKmh / 3.6
  // Vapour pressure
  const e = (humidityPct / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC))
  return (
    tempC +
    0.33 * e -
    0.7 * windMs +
    0.7 * (solarRadiation / (windMs + 10)) -
    4.0
  )
}

/**
 * Dew point from temperature and relative humidity.
 * Magnus formula (Alduchov & Eskridge 1996 coefficients).
 */
export function dewPointFromRH(tempC: number, humidityPct: number): number {
  const a = 17.625
  const b = 243.04
  const alpha = Math.log(humidityPct / 100) + (a * tempC) / (b + tempC)
  return (b * alpha) / (a - alpha)
}

/**
 * Deterministic comfort score 0–100.
 * This is a display-layer index only; decisions must come from GenLayer contracts.
 */
export function computeComfortScore(params: ComfortParams): number {
  const {
    tempC,
    windKmh,
    precipMm,
    humidityPct,
    visibilityM,
    uvIndex,
    weatherCode,
  } = params

  // Thunderstorm hard cap (WMO codes 95–99)
  if (weatherCode >= 95) return Math.min(20, 100)

  let score = 100

  // ── Temperature penalty ──────────────────────────────────────────────────
  if (tempC < 18) {
    const delta = 18 - tempC
    // First 10 °C below: 2 pts/°C; beyond that 4 pts/°C
    score -= delta <= 10 ? delta * 2 : 20 + (delta - 10) * 4
  } else if (tempC > 24) {
    const delta = tempC - 24
    score -= delta <= 10 ? delta * 2 : 20 + (delta - 10) * 4
  }

  // ── Wind penalty ─────────────────────────────────────────────────────────
  if (windKmh > 80) {
    score -= 40
  } else if (windKmh > 50) {
    score -= 25
  } else if (windKmh > 30) {
    score -= 10
  } else if (windKmh > 15) {
    score -= 3
  }

  // ── Precipitation penalty ────────────────────────────────────────────────
  if (precipMm > 15) {
    score -= 35
  } else if (precipMm > 5) {
    score -= 20
  } else if (precipMm > 0.5) {
    score -= 10
  }

  // ── Humidity penalty ─────────────────────────────────────────────────────
  if (humidityPct > 80) {
    score -= Math.round((humidityPct - 80) * 0.5)
  } else if (humidityPct < 25) {
    score -= Math.round((25 - humidityPct) * 0.4)
  }

  // ── Visibility penalty ────────────────────────────────────────────────────
  if (visibilityM < 500) {
    score -= 30
  } else if (visibilityM < 2000) {
    score -= 15
  } else if (visibilityM < 5000) {
    score -= 5
  }

  // ── UV penalty ───────────────────────────────────────────────────────────
  if (uvIndex > 9) {
    score -= 15
  } else if (uvIndex > 6) {
    score -= 5
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Beaufort-derived activity wind rating.
 */
export function windActivityRating(
  windKmh: number,
): 'calm' | 'light' | 'moderate' | 'fresh' | 'strong' | 'near_gale' | 'gale' {
  if (windKmh < 6) return 'calm'
  if (windKmh < 20) return 'light'
  if (windKmh < 29) return 'moderate'
  if (windKmh < 39) return 'fresh'
  if (windKmh < 50) return 'strong'
  if (windKmh < 62) return 'near_gale'
  return 'gale'
}

/**
 * Precipitation intensity label (WMO / METAR convention).
 */
export function precipIntensity(
  mmPerHour: number,
): 'none' | 'trace' | 'light' | 'moderate' | 'heavy' | 'violent' {
  if (mmPerHour <= 0) return 'none'
  if (mmPerHour < 0.5) return 'trace'
  if (mmPerHour < 2.5) return 'light'
  if (mmPerHour < 7.6) return 'moderate'
  if (mmPerHour < 50) return 'heavy'
  return 'violent'
}

/**
 * Human-comfort temperature zone.
 */
export function temperatureZone(
  tempC: number,
):
  | 'extreme_cold'
  | 'very_cold'
  | 'cold'
  | 'cool'
  | 'comfortable'
  | 'warm'
  | 'hot'
  | 'extreme_heat' {
  if (tempC < -20) return 'extreme_cold'
  if (tempC < -5) return 'very_cold'
  if (tempC < 5) return 'cold'
  if (tempC < 13) return 'cool'
  if (tempC <= 26) return 'comfortable'
  if (tempC <= 32) return 'warm'
  if (tempC <= 40) return 'hot'
  return 'extreme_heat'
}

/**
 * Verbal label for how the apparent temperature compares to the actual.
 */
export function feelsLikeLabel(
  apparent: number,
  actual: number,
): 'much_colder' | 'colder' | 'similar' | 'warmer' | 'much_warmer' {
  const diff = apparent - actual
  if (diff < -6) return 'much_colder'
  if (diff < -2) return 'colder'
  if (diff <= 2) return 'similar'
  if (diff <= 6) return 'warmer'
  return 'much_warmer'
}
