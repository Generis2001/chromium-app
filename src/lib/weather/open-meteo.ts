const BASE_URL = "https://api.open-meteo.com/v1/forecast";

const COMMON_PARAMS =
  "&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm&timezone=auto";

const CURRENT_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "precipitation",
  "rain",
  "snowfall",
  "relative_humidity_2m",
  "pressure_msl",
  "surface_pressure",
  "visibility",
  "uv_index",
  "is_day",
  "cloud_cover",
].join(",");

const HOURLY_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "rain",
  "snowfall",
  "snow_depth",
  "weather_code",
  "pressure_msl",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
  "uv_index",
  "relative_humidity_2m",
  "dew_point_2m",
  "cloud_cover",
  "wind_direction_10m",
].join(",");

const DAILY_VARS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "rain_sum",
  "snowfall_sum",
  "precipitation_hours",
  "precipitation_probability_max",
  "weather_code",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "uv_index_max",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
].join(",");

export type CurrentConditions = {
  time: string;
  tempC: number;
  feelsLikeC: number;
  weatherCode: number;
  windKmh: number;
  gustsKmh: number;
  precipMm: number;
  rainMm: number;
  snowMm: number;
  humidityPct: number;
  pressureHpa: number;
  surfacePressureHpa: number;
  visibilityM: number;
  uvIndex: number;
  isDay: boolean;
  cloudCoverPct: number;
};

export type HourlyPoint = {
  time: string;
  tempC: number;
  feelsLikeC: number;
  precipMm: number;
  precipProb: number;
  windKmh: number;
  gustsKmh: number;
  windDir: number;
  weatherCode: number;
  visibilityM: number;
  humidityPct: number;
  dewPointC: number;
  cloudCoverPct: number;
  uvIndex: number;
  pressureHpa: number;
  snowMm: number;
  snowDepthM: number;
  rainMm: number;
};

export type DailyForecast = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  feelsLikeMaxC: number;
  feelsLikeMinC: number;
  precipSumMm: number;
  rainSumMm: number;
  snowSumMm: number;
  precipHours: number;
  precipProbMax: number;
  weatherCode: number;
  windMaxKmh: number;
  gustsMaxKmh: number;
  windDirDominant: number;
  uvIndexMax: number;
  sunrise: string;
  sunset: string;
  daylightDurationS: number;
  sunshineDurationS: number;
};

export type FullWeatherData = {
  current: CurrentConditions;
  hourly: HourlyPoint[];
  daily: DailyForecast[];
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
  lat: number;
  lon: number;
};

type OpenMeteoCurrentUnits = Record<string, string>;

type OpenMeteoCurrent = {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_gusts_10m: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  relative_humidity_2m: number;
  pressure_msl: number;
  surface_pressure: number;
  visibility: number;
  uv_index: number;
  is_day: number;
  cloud_cover: number;
};

type OpenMeteoHourly = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  precipitation: number[];
  rain: number[];
  snowfall: number[];
  snow_depth: number[];
  weather_code: number[];
  pressure_msl: number[];
  visibility: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  uv_index: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  cloud_cover: number[];
  wind_direction_10m: number[];
};

type OpenMeteoDaily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  snowfall_sum: number[];
  precipitation_hours: number[];
  precipitation_probability_max: number[];
  weather_code: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
  uv_index_max: number[];
  sunrise: string[];
  sunset: string[];
  daylight_duration: number[];
  sunshine_duration: number[];
};

type OpenMeteoResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
  current_units?: OpenMeteoCurrentUnits;
  current?: OpenMeteoCurrent;
  hourly?: OpenMeteoHourly;
  daily?: OpenMeteoDaily;
};

function parseCurrent(c: OpenMeteoCurrent): CurrentConditions {
  return {
    time: c.time,
    tempC: c.temperature_2m,
    feelsLikeC: c.apparent_temperature,
    weatherCode: c.weather_code,
    windKmh: c.wind_speed_10m,
    gustsKmh: c.wind_gusts_10m,
    precipMm: c.precipitation,
    rainMm: c.rain,
    snowMm: c.snowfall,
    humidityPct: c.relative_humidity_2m,
    pressureHpa: c.pressure_msl,
    surfacePressureHpa: c.surface_pressure,
    visibilityM: c.visibility,
    uvIndex: c.uv_index,
    isDay: c.is_day === 1,
    cloudCoverPct: c.cloud_cover,
  };
}

function parseHourly(h: OpenMeteoHourly, limit: number): HourlyPoint[] {
  const count = Math.min(h.time.length, limit);
  const points: HourlyPoint[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      time: h.time[i],
      tempC: h.temperature_2m[i],
      feelsLikeC: h.apparent_temperature[i],
      precipMm: h.precipitation[i],
      precipProb: h.precipitation_probability[i] ?? 0,
      windKmh: h.wind_speed_10m[i],
      gustsKmh: h.wind_gusts_10m[i],
      windDir: h.wind_direction_10m[i],
      weatherCode: h.weather_code[i],
      visibilityM: h.visibility[i],
      humidityPct: h.relative_humidity_2m[i],
      dewPointC: h.dew_point_2m[i],
      cloudCoverPct: h.cloud_cover[i],
      uvIndex: h.uv_index[i],
      pressureHpa: h.pressure_msl[i],
      snowMm: h.snowfall[i],
      snowDepthM: h.snow_depth[i],
      rainMm: h.rain[i],
    });
  }
  return points;
}

function parseDaily(d: OpenMeteoDaily, limit: number): DailyForecast[] {
  const count = Math.min(d.time.length, limit);
  const forecasts: DailyForecast[] = [];
  for (let i = 0; i < count; i++) {
    forecasts.push({
      date: d.time[i],
      tempMaxC: d.temperature_2m_max[i],
      tempMinC: d.temperature_2m_min[i],
      feelsLikeMaxC: d.apparent_temperature_max[i],
      feelsLikeMinC: d.apparent_temperature_min[i],
      precipSumMm: d.precipitation_sum[i],
      rainSumMm: d.rain_sum[i],
      snowSumMm: d.snowfall_sum[i],
      precipHours: d.precipitation_hours[i],
      precipProbMax: d.precipitation_probability_max[i] ?? 0,
      weatherCode: d.weather_code[i],
      windMaxKmh: d.wind_speed_10m_max[i],
      gustsMaxKmh: d.wind_gusts_10m_max[i],
      windDirDominant: d.wind_direction_10m_dominant[i],
      uvIndexMax: d.uv_index_max[i],
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
      daylightDurationS: d.daylight_duration[i],
      sunshineDurationS: d.sunshine_duration[i],
    });
  }
  return forecasts;
}

async function fetchWeather(url: string): Promise<OpenMeteoResponse> {
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`Open-Meteo API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<OpenMeteoResponse>;
}

export async function fetchCurrentConditions(
  lat: string,
  lon: string,
): Promise<CurrentConditions> {
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&current=${CURRENT_VARS}${COMMON_PARAMS}`;
  const data = await fetchWeather(url);
  if (!data.current) {
    throw new Error("Open-Meteo response missing current data");
  }
  return parseCurrent(data.current);
}

export async function fetchHourlyForecast(
  lat: string,
  lon: string,
  hours = 24,
): Promise<HourlyPoint[]> {
  const forecastDays = Math.ceil(hours / 24);
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_VARS}&forecast_days=${forecastDays}${COMMON_PARAMS}`;
  const data = await fetchWeather(url);
  if (!data.hourly) {
    throw new Error("Open-Meteo response missing hourly data");
  }
  return parseHourly(data.hourly, hours);
}

export async function fetchDailyForecast(
  lat: string,
  lon: string,
  days = 7,
): Promise<DailyForecast[]> {
  const url = `${BASE_URL}?latitude=${lat}&longitude=${lon}&daily=${DAILY_VARS}&forecast_days=${days}${COMMON_PARAMS}`;
  const data = await fetchWeather(url);
  if (!data.daily) {
    throw new Error("Open-Meteo response missing daily data");
  }
  return parseDaily(data.daily, days);
}

export async function fetchFullWeatherData(
  lat: string,
  lon: string,
): Promise<FullWeatherData> {
  const url =
    `${BASE_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=${CURRENT_VARS}` +
    `&hourly=${HOURLY_VARS}&forecast_days=2` +
    `&daily=${DAILY_VARS}&forecast_days=7` +
    COMMON_PARAMS;

  const data = await fetchWeather(url);

  if (!data.current) throw new Error("Open-Meteo response missing current data");
  if (!data.hourly) throw new Error("Open-Meteo response missing hourly data");
  if (!data.daily) throw new Error("Open-Meteo response missing daily data");

  return {
    current: parseCurrent(data.current),
    hourly: parseHourly(data.hourly, 24),
    daily: parseDaily(data.daily, 7),
    timezone: data.timezone,
    timezone_abbreviation: data.timezone_abbreviation,
    utc_offset_seconds: data.utc_offset_seconds,
    lat: data.latitude,
    lon: data.longitude,
  };
}
