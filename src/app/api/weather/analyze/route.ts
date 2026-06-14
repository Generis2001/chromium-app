/**
 * POST /api/weather/analyze
 *
 * Invokes WeatherAnalysisContract on GenLayer and returns the structured
 * weather decision.  Results are cached in Neon Postgres to avoid
 * unnecessary contract re-invocations for identical recent queries.
 *
 * Body: { lat, lon, query, location_name }
 */

export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { invokeWeatherAnalysis } from "@/lib/genlayer/client";
import {
  getCachedContractResult,
  cacheContractResult,
  logWeatherQuery,
} from "@/lib/db";
import type { WeatherDecision, ApiResponse } from "@/types";

const BodySchema = z.object({
  lat: z.string().regex(/^-?\d+(\.\d+)?$/),
  lon: z.string().regex(/^-?\d+(\.\d+)?$/),
  query: z.string().min(1).max(500),
  location_name: z.string().min(1).max(200),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<WeatherDecision>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { lat, lon, query, location_name } = parsed.data;

    // Cache key: hash of all inputs
    const inputHash = createHash("sha256")
      .update(`${lat}:${lon}:${query}:${location_name}`)
      .digest("hex");

    // Check Neon cache (15-min TTL for weather analysis)
    let cached: Record<string, unknown> | null = null;
    try {
      cached = await getCachedContractResult("weather_analysis", inputHash, 15);
    } catch {
      // DB unavailable — proceed without cache
    }

    if (cached) {
      return NextResponse.json({
        ok: true,
        data: cached as unknown as WeatherDecision,
        cached: true,
      });
    }

    // Invoke GenLayer contract
    const result = await invokeWeatherAnalysis({
      lat,
      lon,
      query,
      location_name,
    });

    // Persist to cache and query log
    try {
      await Promise.all([
        cacheContractResult(
          "weather_analysis",
          location_name,
          lat,
          lon,
          inputHash,
          result,
          15,
        ),
        logWeatherQuery({
          query,
          location: location_name,
          lat,
          lon,
          decision: result.decision,
          risk_level: result.risk_level,
          confidence: result.confidence,
        }),
      ]);
    } catch {
      // Non-fatal — return result regardless
    }

    return NextResponse.json({ ok: true, data: result, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Contract invocation failed";
    console.error("[weather/analyze]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "CONTRACT_ERROR" },
      { status: 500 },
    );
  }
}
