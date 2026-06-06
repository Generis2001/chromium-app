/**
 * POST /api/compare
 *
 * Invokes TravelComparisonContract — compares up to 5 cities for a travel purpose.
 *
 * Body: { locations: [{name, lat, lon}], purpose, travel_date }
 */

export const maxDuration = 150;

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { invokeTravelComparison } from "@/lib/genlayer/client";
import { getCachedContractResult, cacheContractResult } from "@/lib/db";
import type { ComparisonResult, ApiResponse } from "@/types";

const BodySchema = z.object({
  locations: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        lat: z.string().regex(/^-?\d+(\.\d+)?$/),
        lon: z.string().regex(/^-?\d+(\.\d+)?$/),
      }),
    )
    .min(2)
    .max(5),
  purpose: z.enum([
    "travel",
    "business",
    "outdoor_sports",
    "photography",
    "hiking",
    "beach",
  ]),
  travel_date: z.string().min(1).max(30),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ComparisonResult>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { locations, purpose, travel_date } = parsed.data;

    const inputHash = createHash("sha256")
      .update(JSON.stringify({ locations, purpose, travel_date }))
      .digest("hex");

    let cached: Record<string, unknown> | null = null;
    try {
      cached = await getCachedContractResult(
        "travel_comparison",
        inputHash,
        20,
      );
    } catch {
      // proceed
    }

    if (cached) {
      return NextResponse.json({
        ok: true,
        data: cached as unknown as ComparisonResult,
        cached: true,
      });
    }

    const result = await invokeTravelComparison({
      locations,
      purpose,
      travel_date,
    });

    try {
      await cacheContractResult(
        "travel_comparison",
        locations.map((l) => l.name).join(","),
        locations[0].lat,
        locations[0].lon,
        inputHash,
        result,
        20,
      );
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true, data: result, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Contract invocation failed";
    console.error("[compare]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "CONTRACT_ERROR" },
      { status: 500 },
    );
  }
}
