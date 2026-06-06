/**
 * POST /api/alerts
 *
 * Invokes WeatherAlertContract — scans for extreme weather alerts.
 *
 * Body: { lat, lon, location_name, lookahead_hours }
 */

export const maxDuration = 150;

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { invokeWeatherAlert } from "@/lib/genlayer/client";
import { getCachedContractResult, cacheContractResult } from "@/lib/db";
import type { AlertsResult, ApiResponse } from "@/types";

const BodySchema = z.object({
  lat: z.string().regex(/^-?\d+(\.\d+)?$/),
  lon: z.string().regex(/^-?\d+(\.\d+)?$/),
  location_name: z.string().min(1).max(200),
  lookahead_hours: z.enum(["24", "48", "72"]).default("24"),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<AlertsResult>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { lat, lon, location_name, lookahead_hours } = parsed.data;

    const inputHash = createHash("sha256")
      .update(`${lat}:${lon}:${lookahead_hours}`)
      .digest("hex");

    // Alerts cache: short TTL — 10 minutes
    let cached: Record<string, unknown> | null = null;
    try {
      cached = await getCachedContractResult("weather_alert", inputHash, 10);
    } catch {
      // proceed
    }

    if (cached) {
      return NextResponse.json({
        ok: true,
        data: cached as unknown as AlertsResult,
        cached: true,
      });
    }

    const result = await invokeWeatherAlert({
      lat,
      lon,
      location_name,
      lookahead_hours,
    });

    try {
      await cacheContractResult(
        "weather_alert",
        location_name,
        lat,
        lon,
        inputHash,
        result,
        10,
      );
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true, data: result, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Contract invocation failed";
    console.error("[alerts]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "CONTRACT_ERROR" },
      { status: 500 },
    );
  }
}
