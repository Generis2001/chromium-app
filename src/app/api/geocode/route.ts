/**
 * GET /api/geocode?q=<query>&limit=<5>
 *
 * Returns geocoding results for a place name.
 */

import { NextRequest, NextResponse } from "next/server";
import { geocodeLocation } from "@/lib/weather/geocoding";
import type { GeocodingResult, ApiResponse } from "@/types";

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<GeocodingResult[]>>> {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("q")?.trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10), 10);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Query must be at least 2 characters", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const results = await geocodeLocation(query, limit);
    return NextResponse.json({ ok: true, data: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Geocoding failed";
    console.error("[geocode]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "GEOCODING_ERROR" },
      { status: 500 },
    );
  }
}
