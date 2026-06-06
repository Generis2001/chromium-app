import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

type CurrentWeatherResponse = {
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
  visibilityM: number;
  uvIndex: number;
  isDay: boolean;
  cloudCoverPct: number;
  timezone: string;
  timezone_abbreviation: string;
  utc_offset_seconds: number;
};

const COORD_RE = /^-?\d+(\.\d+)?$/;

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<CurrentWeatherResponse>>> {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat")?.trim();
  const lon = searchParams.get("lon")?.trim();

  if (!lat || !lon || !COORD_RE.test(lat) || !COORD_RE.test(lon)) {
    return NextResponse.json(
      { ok: false, error: "Valid numeric lat and lon are required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,` +
    `wind_gusts_10m,precipitation,rain,snowfall,relative_humidity_2m,` +
    `pressure_msl,surface_pressure,visibility,uv_index,is_day,cloud_cover` +
    `&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm&timezone=auto`;

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Open-Meteo error: ${res.status}`, code: "UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    const raw = await res.json() as {
      current: {
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
        visibility: number;
        uv_index: number;
        is_day: number;
        cloud_cover: number;
      };
      timezone: string;
      timezone_abbreviation: string;
      utc_offset_seconds: number;
    };

    const c = raw.current;

    const data: CurrentWeatherResponse = {
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
      visibilityM: c.visibility,
      uvIndex: c.uv_index,
      isDay: c.is_day === 1,
      cloudCoverPct: c.cloud_cover,
      timezone: raw.timezone,
      timezone_abbreviation: raw.timezone_abbreviation,
      utc_offset_seconds: raw.utc_offset_seconds,
    };

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch current weather";
    console.error("[weather/current]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "FETCH_ERROR" },
      { status: 500 },
    );
  }
}
