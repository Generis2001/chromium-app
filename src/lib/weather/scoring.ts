/**
 * Direct TypeScript implementations of the GenLayer contract scoring algorithms.
 * Fetches Open-Meteo data and computes results locally — no GenLayer state dependency.
 */

import type {
  WeatherDecision,
  ActivityAssessment,
  ComparisonResult,
  AlertsResult,
  WeatherAlert,
  AlertType,
  CityScore,
  RankedLocation,
} from "@/types";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const UNITS = "&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm&timezone=auto";

async function omFetch(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

function classifyWmo(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "partly cloudy";
  if (code >= 45 && code < 50) return "foggy";
  if (code >= 51 && code < 68) return "drizzle/rain";
  if (code >= 71 && code < 78) return "snowing";
  if (code >= 80 && code < 83) return "rain showers";
  if (code >= 85 && code < 87) return "snow showers";
  if (code >= 95) return "thunderstorm";
  return "overcast";
}

function sl<T>(arr: T[] | undefined, idx: number, def: T): T {
  return arr && arr.length > idx ? arr[idx] : def;
}

// ─── Weather Analysis ─────────────────────────────────────────────────────────

export async function computeWeatherAnalysis(params: {
  lat: string;
  lon: string;
  query: string;
  location_name: string;
}): Promise<WeatherDecision> {
  const { lat, lon, query, location_name } = params;

  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,relative_humidity_2m,pressure_msl,visibility,uv_index` +
    `&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,visibility,uv_index,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code,precipitation_probability_max,uv_index_max` +
    `&forecast_days=7${UNITS}`;

  const weather = await omFetch(url);
  const current = (weather.current ?? {}) as Record<string, number>;
  const daily = (weather.daily ?? {}) as Record<string, number[]>;

  const temp = current.temperature_2m ?? 20;
  const feels = current.apparent_temperature ?? temp;
  const wind = current.wind_speed_10m ?? 0;
  const gusts = current.wind_gusts_10m ?? 0;
  const precip = current.precipitation ?? 0;
  const humidity = current.relative_humidity_2m ?? 50;
  const visibility = current.visibility ?? 10000;
  const uv = current.uv_index ?? 0;
  const wcode = current.weather_code ?? 0;
  const condition = classifyWmo(wcode);

  let score = 100;
  if (temp < 0) score -= 40;
  else if (temp < 5) score -= 25;
  else if (temp < 10) score -= 10;
  else if (temp > 38) score -= 40;
  else if (temp > 32) score -= 20;
  else if (temp > 28) score -= 8;
  if (wind > 80) score -= 35;
  else if (wind > 50) score -= 20;
  else if (wind > 30) score -= 8;
  if (precip > 10) score -= 30;
  else if (precip > 5) score -= 15;
  else if (precip > 1) score -= 5;
  if (humidity > 90) score -= 10;
  else if (humidity < 20) score -= 8;
  if (visibility < 500) score -= 25;
  else if (visibility < 2000) score -= 10;
  const comfort_score = Math.max(0, Math.min(100, score));

  let risk_level: "LOW" | "MEDIUM" | "HIGH";
  if (wcode >= 95 || wind > 80 || gusts > 100 || precip > 50 || visibility < 200) {
    risk_level = "HIGH";
  } else if (
    (wcode >= 71 && wcode < 78) || (wcode >= 45 && wcode < 50) ||
    wind > 40 || precip > 15 || visibility < 1000 || temp < 0 || temp > 38
  ) {
    risk_level = "MEDIUM";
  } else {
    risk_level = "LOW";
  }

  let decision: "GO" | "CAUTION" | "AVOID";
  if (risk_level === "LOW" && comfort_score >= 70) decision = "GO";
  else if (risk_level === "HIGH" || comfort_score < 40) decision = "AVOID";
  else decision = "CAUTION";

  const confidence = risk_level !== "MEDIUM" ? 90 : 72;

  const parts: string[] = [
    `Current conditions in ${location_name}: ${condition}, ${Math.round(temp)}°C (feels like ${Math.round(feels)}°C)`,
  ];
  if (wind > 20) parts.push(`wind ${Math.round(wind)} km/h with gusts to ${Math.round(gusts)} km/h`);
  if (precip > 0) parts.push(`precipitation ${precip.toFixed(1)} mm`);
  if (humidity > 80) parts.push(`humidity ${Math.round(humidity)}%`);
  const reasoning =
    parts.join(". ") + `. Comfort score: ${comfort_score}/100, risk level: ${risk_level}.`;

  const recommendation =
    decision === "GO"
      ? `Conditions are favourable — go ahead with your plans in ${location_name}.`
      : decision === "AVOID"
      ? `Conditions are hazardous in ${location_name}. Postpone or choose an indoor alternative.`
      : `Conditions are mixed in ${location_name}. Proceed with caution and monitor the forecast.`;

  const key_factors = [
    `Condition: ${condition}`,
    `Temperature: ${Math.round(temp)}°C`,
    `Wind: ${Math.round(wind)} km/h`,
  ];
  if (precip > 0) key_factors.push(`Precipitation: ${precip.toFixed(1)} mm`);
  if (uv > 6) key_factors.push(`UV index: ${Math.round(uv)}`);

  const dailyPrecip = daily.precipitation_sum ?? [];
  const dailyTempMax = daily.temperature_2m_max ?? [];
  const alt_days: number[] = [];
  for (let i = 1; i < Math.min(7, dailyPrecip.length); i++) {
    const dp = dailyPrecip[i] ?? 0;
    const dt = dailyTempMax[i] ?? 20;
    if (dp < 2 && dt >= 10 && dt <= 30) alt_days.push(i);
  }

  return {
    decision,
    confidence,
    risk_level,
    comfort_score,
    condition_class: condition.replace(/ /g, "_"),
    reasoning,
    recommendation,
    alternative_days: alt_days.slice(0, 3),
    key_factors,
    alerts: [],
    location: location_name,
    lat,
    lon,
    query,
  };
}

// ─── Travel Comparison ────────────────────────────────────────────────────────

const PURPOSE_WEIGHTS: Record<string, Record<string, number>> = {
  travel:         { comfort: 0.35, precipitation: 0.30, wind: 0.20, visibility: 0.15 },
  business:       { comfort: 0.40, precipitation: 0.25, wind: 0.15, visibility: 0.20 },
  outdoor_sports: { comfort: 0.25, precipitation: 0.30, wind: 0.25, visibility: 0.20 },
  photography:    { comfort: 0.20, precipitation: 0.20, wind: 0.15, visibility: 0.45 },
  hiking:         { comfort: 0.30, precipitation: 0.30, wind: 0.25, visibility: 0.15 },
  beach:          { comfort: 0.40, precipitation: 0.25, wind: 0.20, visibility: 0.15 },
};

const PURPOSE_NOTES: Record<string, string> = {
  travel:         "Comfort and low precipitation are most important for general travel.",
  business:       "Comfort and reliable visibility matter most for business travel.",
  outdoor_sports: "Precipitation and wind are the key factors for outdoor sports.",
  photography:    "Visibility and light quality are critical for photography conditions.",
  hiking:         "Low precipitation and manageable wind are essential for hiking.",
  beach:          "Warmth, sunshine, and calm winds define the ideal beach day.",
};

function precipScore(mm: number | null): number {
  if (mm == null) return 80;
  if (mm === 0) return 100;
  if (mm < 1) return 90;
  if (mm < 5) return 70;
  if (mm < 15) return 45;
  if (mm < 30) return 20;
  return 5;
}

function windScore(w: number | null, g: number | null): number {
  const top = Math.max(w ?? 0, g ?? 0);
  if (top < 10) return 100;
  if (top < 20) return 90;
  if (top < 35) return 70;
  if (top < 50) return 50;
  if (top < 70) return 25;
  return 5;
}

function comfortScore(tMax: number | null, tMin: number | null): number {
  if (tMax == null || tMin == null) return 70;
  const avg = (tMax + tMin) / 2;
  let s = 100;
  if (avg < 0) s -= 40;
  else if (avg < 8) s -= 20;
  else if (avg < 15) s -= 5;
  else if (avg > 38) s -= 40;
  else if (avg > 32) s -= 20;
  else if (avg > 28) s -= 8;
  return Math.max(0, Math.min(100, s));
}

function visScore(v: number | null): number {
  if (v == null) return 80;
  if (v >= 10000) return 100;
  if (v >= 5000) return 85;
  if (v >= 2000) return 60;
  if (v >= 500) return 30;
  return 5;
}

export async function computeTravelComparison(params: {
  locations: Array<{ name: string; lat: string; lon: string }>;
  purpose: string;
  travel_date: string;
}): Promise<ComparisonResult> {
  const { locations, purpose, travel_date } = params;
  const weights = PURPOSE_WEIGHTS[purpose] ?? PURPOSE_WEIGHTS.travel;

  let dayIdx = 0;
  if (travel_date === "tomorrow") dayIdx = 1;
  else if (travel_date === "weekend" || travel_date === "saturday") dayIdx = 5;
  else if (travel_date === "sunday") dayIdx = 6;

  const limited = locations.slice(0, 5);

  const cityData: CityScore[] = await Promise.all(
    limited.map(async (loc) => {
      const url =
        `${OPEN_METEO}?latitude=${loc.lat}&longitude=${loc.lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,visibility` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code,precipitation_probability_max` +
        `&forecast_days=7${UNITS}`;

      const data = await omFetch(url);
      const current = (data.current ?? {}) as Record<string, number>;
      const daily = (data.daily ?? {}) as Record<string, (number | null)[]>;

      let ps: number, ws: number, cs: number, vs: number, cond: string, tempC: number | null;

      if (dayIdx === 0) {
        ps = precipScore(current.precipitation ?? 0);
        ws = windScore(current.wind_speed_10m ?? 0, current.wind_gusts_10m ?? 0);
        cs = comfortScore(current.temperature_2m ?? 20, current.apparent_temperature ?? 20);
        vs = visScore(current.visibility ?? 10000);
        cond = classifyWmo(current.weather_code ?? 0);
        tempC = current.temperature_2m ?? null;
      } else {
        ps = precipScore(sl(daily.precipitation_sum, dayIdx, null));
        ws = windScore(sl(daily.wind_speed_10m_max, dayIdx, null), sl(daily.wind_gusts_10m_max, dayIdx, null));
        cs = comfortScore(sl(daily.temperature_2m_max, dayIdx, null), sl(daily.temperature_2m_min, dayIdx, null));
        vs = visScore(null);
        cond = classifyWmo(sl(daily.weather_code, dayIdx, 0) ?? 0);
        const tMax = sl(daily.temperature_2m_max, dayIdx, 20) ?? 20;
        const tMin = sl(daily.temperature_2m_min, dayIdx, 10) ?? 10;
        tempC = (tMax + tMin) / 2;
      }

      const overall =
        Math.round(
          (cs * weights.comfort +
            ps * weights.precipitation +
            ws * weights.wind +
            vs * weights.visibility) *
            10,
        ) / 10;

      return {
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        overall_score: overall,
        comfort_score: cs,
        precipitation_score: ps,
        wind_score: ws,
        visibility_score: vs,
        condition: cond,
        temp_current: tempC,
      };
    }),
  );

  cityData.sort((a, b) => b.overall_score - a.overall_score || a.name.localeCompare(b.name));
  const best = cityData[0];
  const runnerUp = cityData[1] ?? null;

  const reasoningParts = [
    `${best.name} ranks first with a weather score of ${Math.round(best.overall_score)}/100 (${best.condition} conditions` +
      (best.temp_current != null ? `, ${Math.round(best.temp_current)}°C` : "") +
      ")",
  ];
  if (runnerUp) {
    const gap = best.overall_score - runnerUp.overall_score;
    reasoningParts.push(
      `${runnerUp.name} scores ${Math.round(runnerUp.overall_score)} (${Math.round(gap)} points behind, ${runnerUp.condition})`,
    );
  }
  const reasoning = reasoningParts.join(". ") + ` for ${purpose} on ${travel_date}.`;

  const ranked_locations: RankedLocation[] = cityData.map((c, i) => {
    const desc: string[] = [];
    if (c.comfort_score >= 80) desc.push("comfortable temps");
    else if (c.comfort_score < 50) desc.push("uncomfortable temps");
    if (c.precipitation_score >= 90) desc.push("dry");
    else if (c.precipitation_score < 50) desc.push("wet");
    if (c.wind_score >= 90) desc.push("calm");
    else if (c.wind_score < 50) desc.push("windy");
    return {
      rank: i + 1,
      name: c.name,
      overall_score: c.overall_score,
      reason:
        c.condition.charAt(0).toUpperCase() + c.condition.slice(1) +
        (desc.length ? `, ${desc.join(", ")}` : "") +
        `. Score: ${Math.round(c.overall_score)}/100`,
      condition: c.condition,
    };
  });

  return {
    best_location: best.name,
    reasoning,
    ranked_locations,
    purpose_note: PURPOSE_NOTES[purpose] ?? `Weather ranked for ${purpose} travel.`,
    scores: cityData,
    purpose,
    travel_date,
  };
}

// ─── Activity Risk ────────────────────────────────────────────────────────────

const ACTIVITY_CONFIGS: Record<string, {
  ideal: [number, number];
  max_precip: number;
  max_wind: number;
  uv: boolean;
  vis: boolean;
}> = {
  farming:         { ideal: [5, 30],   max_precip: 5,   max_wind: 30,  uv: false, vis: false },
  outdoor_sports:  { ideal: [10, 28],  max_precip: 2,   max_wind: 25,  uv: true,  vis: false },
  construction:    { ideal: [2, 35],   max_precip: 10,  max_wind: 50,  uv: false, vis: false },
  camping:         { ideal: [8, 28],   max_precip: 5,   max_wind: 35,  uv: true,  vis: true  },
  photography:     { ideal: [-5, 40],  max_precip: 1,   max_wind: 20,  uv: false, vis: true  },
  travel:          { ideal: [0, 38],   max_precip: 8,   max_wind: 60,  uv: false, vis: true  },
  marathon_running:{ ideal: [10, 20],  max_precip: 5,   max_wind: 20,  uv: true,  vis: false },
  cycling:         { ideal: [8, 30],   max_precip: 3,   max_wind: 30,  uv: true,  vis: false },
  beach:           { ideal: [24, 35],  max_precip: 1,   max_wind: 30,  uv: true,  vis: false },
  skiing:          { ideal: [-15, 2],  max_precip: 999, max_wind: 45,  uv: true,  vis: true  },
};

const SAFETY_TIPS: Record<string, string[]> = {
  farming:         ["Irrigate if dry", "Secure equipment in high winds", "Take shade breaks in heat"],
  outdoor_sports:  ["Warm up properly", "Stay hydrated", "Wear UV protection if sunny"],
  construction:    ["Secure scaffolding in wind", "Halt work in lightning", "Hydrate in heat"],
  camping:         ["Check tent guy ropes", "Store food safely", "Monitor overnight temps"],
  photography:     ["Protect lens from rain", "Use ND filter in bright sun", "Bring cleaning kit"],
  travel:          ["Check airport/road alerts", "Allow extra journey time", "Pack layers"],
  marathon_running:["Start hydrated", "Run in cooler parts of day", "Watch for heat exhaustion"],
  cycling:         ["Check tyre pressure", "Wear hi-vis in poor visibility", "Avoid wet road camber"],
  beach:           ["Apply SPF 50+", "Stay hydrated", "Swim near lifeguards only"],
  skiing:          ["Check avalanche forecast", "Wear goggles for UV", "Buddy system in low vis"],
};

const GEAR: Record<string, string[]> = {
  farming:         ["Sun hat", "Waterproof boots"],
  outdoor_sports:  ["Light rain jacket", "Sun cream SPF30+"],
  construction:    ["Hard hat", "High-vis jacket", "Gloves"],
  camping:         ["4-season sleeping bag", "Waterproof tent", "Head torch"],
  photography:     ["Rain cover for camera", "Lens cloth", "Polarising filter"],
  travel:          ["Compact umbrella", "Layers", "Waterproof bag cover"],
  marathon_running:["Moisture-wicking kit", "Electrolyte tabs", "Cap/visor"],
  cycling:         ["Mudguards", "Waterproof jacket", "Cycling glasses"],
  beach:           ["SPF 50 sunscreen", "Sun hat", "UV swimwear"],
  skiing:          ["Goggles", "Thermal base layer", "Avalanche beacon"],
};

export async function computeActivityRisk(params: {
  lat: string;
  lon: string;
  activity: string;
  location_name: string;
  target_date: string;
  duration_hours: string;
}): Promise<ActivityAssessment> {
  const { lat, lon, location_name, target_date, duration_hours } = params;
  const actKey = params.activity.toLowerCase().replace(/ /g, "_");
  const cfg = ACTIVITY_CONFIGS[actKey] ?? ACTIVITY_CONFIGS.outdoor_sports;

  let dayIdx = 0;
  if (target_date === "tomorrow") dayIdx = 1;
  else if (/^\d+$/.test(target_date)) dayIdx = Math.min(parseInt(target_date), 6);

  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,relative_humidity_2m,visibility,uv_index` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code,precipitation_probability_max,uv_index_max,sunrise,sunset` +
    `&forecast_days=7${UNITS}`;

  const data = await omFetch(url);
  const current = (data.current ?? {}) as Record<string, number>;
  const daily = (data.daily ?? {}) as Record<string, (number | string | null)[]>;

  let temp: number, precip: number, wind: number, gusts: number,
      vis: number, humidity: number, uv: number, wcode: number,
      sunrise: string, sunset: string;

  if (dayIdx === 0) {
    temp     = current.temperature_2m ?? 20;
    precip   = current.precipitation ?? 0;
    wind     = current.wind_speed_10m ?? 0;
    gusts    = current.wind_gusts_10m ?? 0;
    vis      = current.visibility ?? 10000;
    humidity = current.relative_humidity_2m ?? 50;
    uv       = current.uv_index ?? 0;
    wcode    = current.weather_code ?? 0;
    sunrise  = String(sl(daily.sunrise as string[], 0, "06:00"));
    sunset   = String(sl(daily.sunset as string[], 0, "20:00"));
  } else {
    const tMax = (sl(daily.temperature_2m_max as number[], dayIdx, 20)) ?? 20;
    const tMin = (sl(daily.temperature_2m_min as number[], dayIdx, 10)) ?? 10;
    temp     = (tMax + tMin) / 2;
    precip   = (sl(daily.precipitation_sum as number[], dayIdx, 0)) ?? 0;
    wind     = (sl(daily.wind_speed_10m_max as number[], dayIdx, 0)) ?? 0;
    gusts    = (sl(daily.wind_gusts_10m_max as number[], dayIdx, 0)) ?? 0;
    vis      = 8000;
    humidity = 60;
    uv       = (sl(daily.uv_index_max as number[], dayIdx, 0)) ?? 0;
    wcode    = (sl(daily.weather_code as number[], dayIdx, 0)) ?? 0;
    sunrise  = String(sl(daily.sunrise as string[], dayIdx, "06:00"));
    sunset   = String(sl(daily.sunset as string[], dayIdx, "20:00"));
  }

  const [idealLo, idealHi] = cfg.ideal;
  let penalty = 0;
  const concerns: string[] = [];

  if (temp < idealLo) {
    penalty += Math.min(40, (idealLo - temp) * 3);
    concerns.push(`Temperature ${Math.round(temp)}°C is below ideal range (${idealLo}°C–${idealHi}°C)`);
  } else if (temp > idealHi) {
    penalty += Math.min(40, (temp - idealHi) * 3);
    concerns.push(`Temperature ${Math.round(temp)}°C exceeds ideal range (${idealLo}°C–${idealHi}°C)`);
  }

  if (precip > cfg.max_precip) {
    penalty += Math.min(35, (precip - cfg.max_precip) * 4);
    concerns.push(`Precipitation ${precip.toFixed(1)} mm exceeds threshold (${cfg.max_precip} mm)`);
  }

  const effWind = Math.max(wind, gusts * 0.7);
  if (effWind > cfg.max_wind) {
    penalty += Math.min(30, (effWind - cfg.max_wind) * 1.5);
    concerns.push(`Wind ${Math.round(wind)} km/h (gusts ${Math.round(gusts)} km/h) exceeds safe limit (${cfg.max_wind} km/h)`);
  }

  if (cfg.vis && vis < 2000) {
    penalty += vis < 500 ? 20 : 10;
    concerns.push(`Low visibility: ${Math.round(vis)} m`);
  }

  if (cfg.uv && uv > 8) {
    penalty += Math.min(20, (uv - 8) * 4);
    concerns.push(`High UV index: ${Math.round(uv)}`);
  }

  const wc = Math.round(wcode);
  if (wc >= 95) { penalty += 50; concerns.push("Thunderstorm conditions present"); }
  else if (wc >= 80) { penalty += 20; concerns.push("Heavy rain showers expected"); }
  else if (wc >= 71 && actKey !== "skiing") { penalty += 25; concerns.push("Snowfall expected"); }

  const risk_score = Math.max(0, Math.min(100, 100 - penalty));
  let risk_level: "LOW" | "MEDIUM" | "HIGH";
  let suitability: "SUITABLE" | "MARGINAL" | "UNSUITABLE";
  if (risk_score >= 75) { risk_level = "LOW"; suitability = "SUITABLE"; }
  else if (risk_score >= 50) { risk_level = "MEDIUM"; suitability = "MARGINAL"; }
  else { risk_level = "HIGH"; suitability = "UNSUITABLE"; }

  const actLabel = actKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  let recommendation: string;
  if (suitability === "SUITABLE")
    recommendation = `Conditions are good for ${actLabel} in ${location_name}. Go ahead with your ${duration_hours}-hour session.`;
  else if (suitability === "MARGINAL")
    recommendation = `Conditions are acceptable for ${actLabel} in ${location_name} but monitor weather closely during your ${duration_hours}-hour session.`;
  else
    recommendation = `Conditions are poor for ${actLabel} in ${location_name}. Consider rescheduling your ${duration_hours}-hour session.`;

  if (!concerns.length) concerns.push(`Conditions within normal range for ${actLabel}`);

  let best_time_window: string;
  try {
    const srStr = sunrise.split("T").pop()?.slice(0, 5) ?? "06:00";
    const ssStr = sunset.split("T").pop()?.slice(0, 5) ?? "20:00";
    if (wind > 30 || precip > 2)
      best_time_window = `Early morning (${srStr}–${srStr.slice(0, 2)}:00+2h) before conditions deteriorate`;
    else if (uv > 7)
      best_time_window = `Morning (${srStr}–11:00) or late afternoon (16:00–${ssStr}) to avoid peak UV`;
    else
      best_time_window = `Any time between ${srStr} and ${ssStr}`;
  } catch {
    best_time_window = "Morning hours recommended";
  }

  return {
    activity: params.activity,
    suitability,
    risk_level,
    risk_score,
    recommendation,
    key_concerns: concerns.slice(0, 4),
    safety_tips: (SAFETY_TIPS[actKey] ?? ["Check local conditions", "Dress appropriately"]).slice(0, 3),
    best_time_window,
    gear_suggestions: (GEAR[actKey] ?? ["Weather-appropriate clothing"]).slice(0, 3),
    location: location_name,
    target_date,
    duration_hours,
    metrics: {
      temp_c: Math.round(temp * 10) / 10,
      precip_mm: Math.round(precip * 10) / 10,
      wind_kmh: Math.round(wind),
      gusts_kmh: Math.round(gusts),
      visibility_m: Math.round(vis),
      humidity_pct: Math.round(humidity),
      uv_index: Math.round(uv * 10) / 10,
    },
  };
}

// ─── Weather Alerts ───────────────────────────────────────────────────────────

const ALERT_TITLES: Record<string, string> = {
  thunderstorm:        "Thunderstorm Warning",
  heavy_precipitation: "Heavy Precipitation Warning",
  extreme_heat:        "Extreme Heat Warning",
  extreme_cold:        "Extreme Cold Warning",
  high_wind:           "High Wind Warning",
  dense_fog:           "Dense Fog Advisory",
  heavy_snow:          "Heavy Snowfall Warning",
  extreme_uv:          "Extreme UV Advisory",
  rapid_pressure_drop: "Rapid Pressure Drop Watch",
};

const ALERT_SAFETY: Record<string, string[]> = {
  thunderstorm:        ["Seek indoor shelter immediately", "Stay away from trees and open fields", "Unplug electronic devices"],
  heavy_precipitation: ["Avoid flood-prone areas", "Do not drive through standing water", "Monitor drainage around property"],
  extreme_heat:        ["Stay hydrated and indoors during peak hours", "Check on elderly neighbours", "Never leave children or pets in vehicles"],
  extreme_cold:        ["Dress in warm layers", "Limit outdoor exposure", "Watch for signs of frostbite and hypothermia"],
  high_wind:           ["Secure loose outdoor items", "Avoid travel if possible", "Stay clear of trees and power lines"],
  dense_fog:           ["Slow down and use fog lights when driving", "Allow extra journey time", "Increase following distance"],
  heavy_snow:          ["Avoid unnecessary travel", "Keep emergency kit in vehicle", "Clear snow from vents and roofs"],
  extreme_uv:          ["Apply SPF 50+ sunscreen", "Wear protective clothing and hat", "Seek shade during 10am–4pm"],
  rapid_pressure_drop: ["Monitor updated forecasts closely", "Prepare for deteriorating conditions", "Secure outdoor items in advance"],
};

export async function computeWeatherAlerts(params: {
  lat: string;
  lon: string;
  location_name: string;
  lookahead_hours: string;
}): Promise<AlertsResult> {
  const { lat, lon, location_name, lookahead_hours } = params;
  const hours = Math.max(6, Math.min(72, parseInt(lookahead_hours) || 24));
  const forecastDays = Math.max(1, Math.ceil(hours / 24));

  const url =
    `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,precipitation,visibility,pressure_msl,uv_index,snowfall` +
    `&forecast_days=${forecastDays}${UNITS}`;

  const data = await omFetch(url);
  const hourly = (data.hourly ?? {}) as Record<string, (number | null)[]>;

  const hTemp   = (hourly.temperature_2m   ?? []).slice(0, hours);
  const hWcode  = (hourly.weather_code     ?? []).slice(0, hours);
  const hWind   = (hourly.wind_speed_10m   ?? []).slice(0, hours);
  const hGusts  = (hourly.wind_gusts_10m   ?? []).slice(0, hours);
  const hPrecip = (hourly.precipitation    ?? []).slice(0, hours);
  const hVis    = (hourly.visibility       ?? []).slice(0, hours);
  const hPres   = (hourly.pressure_msl     ?? []).slice(0, hours);
  const hUv     = (hourly.uv_index         ?? []).slice(0, hours);
  const hSnow   = (hourly.snowfall         ?? []).slice(0, hours);

  const sm = (arr: (number | null)[]) => Math.max(...arr.filter((x): x is number => x != null), 0);
  const sn = (arr: (number | null)[]) => Math.min(...arr.filter((x): x is number => x != null), Infinity);
  const ss = (arr: (number | null)[]) => arr.reduce<number>((a, x) => a + (x ?? 0), 0);
  const iw = (arr: (number | null)[], fn: (v: number) => boolean) =>
    arr.map((v, i) => (v != null && fn(v) ? i : -1)).filter((i) => i >= 0);

  type RawAlert = { type: string; severity: "WATCH" | "WARNING" | "EMERGENCY"; affected_hours: number[]; peak_value: number };
  const rawAlerts: RawAlert[] = [];

  const thunder = iw(hWcode, (c) => c >= 95);
  if (thunder.length)
    rawAlerts.push({ type: "thunderstorm", severity: thunder.length >= 3 ? "EMERGENCY" : "WARNING", affected_hours: thunder, peak_value: Math.max(...thunder.map((i) => hWcode[i] ?? 0)) });

  const tp = ss(hPrecip), mp = sm(hPrecip);
  if (tp > 50 || mp > 15)
    rawAlerts.push({ type: "heavy_precipitation", severity: tp > 100 || mp > 30 ? "EMERGENCY" : "WARNING", affected_hours: iw(hPrecip, (p) => p > 5), peak_value: Math.round(mp * 10) / 10 });

  const mxT = sm(hTemp);
  if (mxT > 38)
    rawAlerts.push({ type: "extreme_heat", severity: mxT > 43 ? "EMERGENCY" : "WARNING", affected_hours: iw(hTemp, (t) => t > 38), peak_value: Math.round(mxT * 10) / 10 });

  const mnT = sn(hTemp);
  if (mnT < -15)
    rawAlerts.push({ type: "extreme_cold", severity: mnT < -25 ? "EMERGENCY" : "WARNING", affected_hours: iw(hTemp, (t) => t < -15), peak_value: Math.round(mnT * 10) / 10 });

  const mw = sm(hWind), mg = sm(hGusts);
  if (mw > 80 || mg > 100)
    rawAlerts.push({ type: "high_wind", severity: mw > 100 || mg > 130 ? "EMERGENCY" : "WARNING", affected_hours: iw(hWind, (w) => w > 60), peak_value: Math.round(mg * 10) / 10 });

  const mv = sn(hVis);
  if (mv < 500 && mv !== Infinity)
    rawAlerts.push({ type: "dense_fog", severity: mv < 100 ? "EMERGENCY" : "WARNING", affected_hours: iw(hVis, (v) => v < 500), peak_value: Math.round(mv) });

  const ts = ss(hSnow), ms = sm(hSnow);
  if (ts > 20 || ms > 5)
    rawAlerts.push({ type: "heavy_snow", severity: ts >= 50 ? "EMERGENCY" : "WARNING", affected_hours: iw(hSnow, (s) => s > 2), peak_value: Math.round(ms * 10) / 10 });

  const mu = sm(hUv);
  if (mu >= 11)
    rawAlerts.push({ type: "extreme_uv", severity: "WARNING", affected_hours: iw(hUv, (u) => u >= 8), peak_value: Math.round(mu * 10) / 10 });

  for (let i = 0; i < hPres.length - 6; i++) {
    const p1 = hPres[i], p2 = hPres[i + 6];
    if (p1 != null && p2 != null && p1 - p2 > 5) {
      rawAlerts.push({ type: "rapid_pressure_drop", severity: "WATCH", affected_hours: Array.from({ length: Math.min(12, hPres.length - i) }, (_, k) => i + k), peak_value: Math.round((p1 - p2) * 10) / 10 });
      break;
    }
  }

  if (!rawAlerts.length) {
    return {
      location: location_name, lat, lon,
      alert_count: 0, alerts: [],
      overall_severity: "NONE",
      summary: `No significant weather alerts for ${location_name} in the next ${hours} hours.`,
    };
  }

  const sevs = rawAlerts.map((a) => a.severity);
  const overall = sevs.includes("EMERGENCY") ? "EMERGENCY" : sevs.includes("WARNING") ? "WARNING" : "WATCH";

  const alerts: WeatherAlert[] = rawAlerts.map((a, i) => {
    const t = a.type;
    const pv = a.peak_value;
    const aff = a.affected_hours;
    const descMap: Record<string, string> = {
      thunderstorm:        `Thunderstorm activity detected with WMO code ${Math.round(pv)} across ${aff.length} affected hours.`,
      heavy_precipitation: `Total precipitation of ${Math.round(ss(hPrecip))} mm expected with peak hourly rate of ${pv} mm.`,
      extreme_heat:        `Temperatures reaching ${pv}°C detected across ${aff.length} hours.`,
      extreme_cold:        `Temperatures dropping to ${pv}°C detected across ${aff.length} hours.`,
      high_wind:           `Wind gusts up to ${pv} km/h expected across ${aff.length} hours.`,
      dense_fog:           `Visibility dropping to ${Math.round(pv)} m detected across ${aff.length} hours.`,
      heavy_snow:          `Snowfall up to ${pv} cm/h expected across ${aff.length} hours.`,
      extreme_uv:          `UV index reaching ${Math.round(pv)} across ${aff.length} hours.`,
      rapid_pressure_drop: `Pressure drop of ${pv} hPa detected over 6 hours — storm front approaching.`,
    };
    return {
      id: `${t}_${i}`,
      type: t as AlertType,
      severity: a.severity,
      title: ALERT_TITLES[t] ?? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: descMap[t] ?? `${t.replace(/_/g, " ")} conditions detected.`,
      peak_value: pv,
      affected_hours: aff,
      safety_actions: ALERT_SAFETY[t] ?? ["Monitor local weather", "Take appropriate precautions", "Follow official guidance"],
      expires_hours: aff.length || hours,
    };
  });

  const types = rawAlerts.map((a) => a.type.replace(/_/g, " "));
  return {
    location: location_name, lat, lon,
    alert_count: alerts.length,
    alerts,
    overall_severity: overall as AlertsResult["overall_severity"],
    summary: `${overall} level alert for ${location_name}. Active conditions: ${types.join(", ")}. Covering the next ${hours} hours.`,
  };
}
