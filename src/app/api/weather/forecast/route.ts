import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

const COORD_RE = /^-?\d+(\.\d+)?$/;
const DAYS_RE = /^\d+$/;

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<Record<string, unknown>>>> {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat")?.trim();
  const lon = searchParams.get("lon")?.trim();
  const refresh = searchParams.get("refresh");
  const daysParam = searchParams.get("days")?.trim() ?? "7";
  const hoursParam = searchParams.get("hours")?.trim() ?? "24";

  if (!lat || !lon || !COORD_RE.test(lat) || !COORD_RE.test(lon)) {
    return NextResponse.json(
      { ok: false, error: "Valid numeric lat and lon are required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  if (!DAYS_RE.test(daysParam) || !DAYS_RE.test(hoursParam)) {
    return NextResponse.json(
      { ok: false, error: "days and hours must be positive integers", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const days = Math.min(parseInt(daysParam, 10), 16);
  const forecastHours = Math.min(parseInt(hoursParam, 10), 384);

  const hourlyVars = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
    "wind_gusts_10m",
    "visibility",
    "relative_humidity_2m",
    "uv_index",
    "cloud_cover",
    "wind_direction_10m",
  ].join(",");

  const dailyVars = [
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

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${hourlyVars}` +
    `&daily=${dailyVars}` +
    `&forecast_days=${days}` +
    `&forecast_hours=${forecastHours}` +
    `&wind_speed_unit=kmh&temperature_unit=celsius&precipitation_unit=mm&timezone=auto`;

  try {
    const res = await fetch(
      url,
      refresh ? { cache: "no-store" } : { next: { revalidate: 600 } },
    );

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Open-Meteo error: ${res.status}`, code: "UPSTREAM_ERROR" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch forecast";
    console.error("[weather/forecast]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "FETCH_ERROR" },
      { status: 500 },
    );
  }
}
