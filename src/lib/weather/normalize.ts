export type WeatherCondition =
  | "clear"
  | "mostly_clear"
  | "partly_cloudy"
  | "overcast"
  | "fog"
  | "rime_fog"
  | "light_drizzle"
  | "moderate_drizzle"
  | "heavy_drizzle"
  | "freezing_drizzle"
  | "light_rain"
  | "moderate_rain"
  | "heavy_rain"
  | "freezing_rain"
  | "light_snow"
  | "moderate_snow"
  | "heavy_snow"
  | "snow_grains"
  | "light_showers"
  | "moderate_showers"
  | "heavy_showers"
  | "snow_showers"
  | "thunderstorm"
  | "thunderstorm_hail";

const WMO_CONDITION_MAP: Record<number, WeatherCondition> = {
  0: "clear",
  1: "mostly_clear",
  2: "partly_cloudy",
  3: "overcast",
  45: "fog",
  48: "rime_fog",
  51: "light_drizzle",
  52: "light_drizzle",
  53: "moderate_drizzle",
  54: "moderate_drizzle",
  55: "heavy_drizzle",
  56: "freezing_drizzle",
  57: "freezing_drizzle",
  61: "light_rain",
  62: "light_rain",
  63: "moderate_rain",
  64: "moderate_rain",
  65: "heavy_rain",
  66: "freezing_rain",
  67: "freezing_rain",
  71: "light_snow",
  72: "light_snow",
  73: "moderate_snow",
  74: "moderate_snow",
  75: "heavy_snow",
  77: "snow_grains",
  80: "light_showers",
  81: "moderate_showers",
  82: "heavy_showers",
  85: "snow_showers",
  86: "snow_showers",
  95: "thunderstorm",
  96: "thunderstorm_hail",
  99: "thunderstorm_hail",
};

const WMO_DESCRIPTION_MAP: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  52: "Light drizzle",
  53: "Moderate drizzle",
  54: "Moderate drizzle",
  55: "Heavy drizzle",
  56: "Light freezing drizzle",
  57: "Heavy freezing drizzle",
  61: "Light rain",
  62: "Light rain",
  63: "Moderate rain",
  64: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  72: "Light snow",
  73: "Moderate snow",
  74: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Moderate showers",
  82: "Heavy showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with light hail",
  99: "Thunderstorm with heavy hail",
};

const WMO_DAY_ICON_MAP: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  52: "🌦️",
  53: "🌧️",
  54: "🌧️",
  55: "🌧️",
  56: "🌨️",
  57: "🌨️",
  61: "🌧️",
  62: "🌧️",
  63: "🌧️",
  64: "🌧️",
  65: "🌧️",
  66: "🌨️",
  67: "🌨️",
  71: "🌨️",
  72: "🌨️",
  73: "❄️",
  74: "❄️",
  75: "❄️",
  77: "🌨️",
  80: "🌦️",
  81: "🌧️",
  82: "🌧️",
  85: "🌨️",
  86: "❄️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

const WMO_NIGHT_ICON_MAP: Record<number, string> = {
  ...WMO_DAY_ICON_MAP,
  0: "🌙",
  1: "🌙",
  2: "☁️",
};

const EXTREME_CODES = new Set([55, 57, 65, 67, 75, 82, 86, 95, 96, 99]);
const PRECIPITATION_CODES = new Set([
  51, 52, 53, 54, 55, 56, 57, 61, 62, 63, 64, 65, 66, 67, 71, 72, 73, 74, 75,
  77, 80, 81, 82, 85, 86, 95, 96, 99,
]);

export function wmoToCondition(code: number): WeatherCondition {
  return WMO_CONDITION_MAP[code] ?? "overcast";
}

export function wmoToIcon(code: number, isDay: boolean): string {
  const map = isDay ? WMO_DAY_ICON_MAP : WMO_NIGHT_ICON_MAP;
  return map[code] ?? "🌡️";
}

export function wmoToDescription(code: number): string {
  return WMO_DESCRIPTION_MAP[code] ?? "Unknown conditions";
}

export function isExtremeCondition(code: number): boolean {
  return EXTREME_CODES.has(code);
}

export function isPrecipitating(code: number): boolean {
  return PRECIPITATION_CODES.has(code);
}

export type BeaufortResult = {
  force: number;
  description: string;
};

const BEAUFORT_THRESHOLDS: Array<[number, string]> = [
  [1, "Calm"],
  [5, "Light air"],
  [11, "Light breeze"],
  [19, "Gentle breeze"],
  [28, "Moderate breeze"],
  [38, "Fresh breeze"],
  [49, "Strong breeze"],
  [61, "Near gale"],
  [74, "Gale"],
  [88, "Severe gale"],
  [102, "Storm"],
  [117, "Violent storm"],
  [Infinity, "Hurricane force"],
];

export function beaufortScale(windKmh: number): BeaufortResult {
  for (let force = 0; force < BEAUFORT_THRESHOLDS.length; force++) {
    const [threshold, description] = BEAUFORT_THRESHOLDS[force];
    if (windKmh < threshold) {
      return { force, description };
    }
  }
  return { force: 12, description: "Hurricane force" };
}

export function uvRiskLevel(
  uvIndex: number,
): "low" | "moderate" | "high" | "very_high" | "extreme" {
  if (uvIndex < 3) return "low";
  if (uvIndex < 6) return "moderate";
  if (uvIndex < 8) return "high";
  if (uvIndex < 11) return "very_high";
  return "extreme";
}

export function visibilityCategory(
  meters: number,
): "excellent" | "good" | "moderate" | "poor" | "very_poor" {
  if (meters >= 10000) return "excellent";
  if (meters >= 4000) return "good";
  if (meters >= 1000) return "moderate";
  if (meters >= 200) return "poor";
  return "very_poor";
}

export function pressureTrend(
  current: number,
  previous: number,
): "rising" | "steady" | "falling" {
  const delta = current - previous;
  // ±0.5 hPa treated as steady to avoid noise from minor fluctuations
  if (delta > 0.5) return "rising";
  if (delta < -0.5) return "falling";
  return "steady";
}
