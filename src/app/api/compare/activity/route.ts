export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { assessActivityWithCache } from "@/lib/genlayer/assess-helpers";
import { getCachedContractResult, cacheContractResult } from "@/lib/db";
import { SUPPORTED_ACTIVITIES } from "@/types";
import type { ActivityComparisonResult, ActivityCityScore, ApiResponse } from "@/types";

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
  activity: z.enum(SUPPORTED_ACTIVITIES),
  target_date: z.string().min(1).max(30),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ActivityComparisonResult>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { locations, activity, target_date } = parsed.data;

    const inputHash = createHash("sha256")
      .update(JSON.stringify({ locations, activity, target_date }))
      .digest("hex");

    try {
      const cached = await getCachedContractResult(
        "activity_comparison",
        inputHash,
        20,
      );
      if (cached) {
        return NextResponse.json({
          ok: true,
          data: cached as unknown as ActivityComparisonResult,
          cached: true,
        });
      }
    } catch {
      // proceed
    }

    const partial_failures: string[] = [];
    const scored: ActivityCityScore[] = [];

    for (const loc of locations) {
      try {
        const a = await assessActivityWithCache({
          lat: loc.lat,
          lon: loc.lon,
          activity,
          location_name: loc.name,
          target_date,
          duration_hours: "4",
        });
        scored.push({
          name: loc.name,
          rank: 0,
          overall_score: 100 - a.risk_score,
          suitability: a.suitability,
          risk_level: a.risk_level,
          risk_score: a.risk_score,
          key_concerns: a.key_concerns,
          recommendation: a.recommendation,
          best_time_window: a.best_time_window,
        });
      } catch {
        partial_failures.push(loc.name);
      }
    }

    if (scored.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "All location assessments failed",
          code: "CONTRACT_ERROR",
        },
        { status: 500 },
      );
    }

    scored.sort((a, b) => b.overall_score - a.overall_score);
    scored.forEach((s, i) => {
      s.rank = i + 1;
    });

    const best = scored[0];
    const result: ActivityComparisonResult = {
      best_location: best.name,
      reasoning: `${best.name} scored highest (${best.overall_score}/100) with ${best.suitability.toLowerCase()} conditions for ${activity}.`,
      ranked_locations: scored,
      purpose_note: `Rankings based on activity risk assessment for ${activity} on ${target_date}.`,
      activity,
      target_date,
      partial_failures,
    };

    try {
      await cacheContractResult(
        "activity_comparison",
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
      err instanceof Error ? err.message : "Activity comparison failed";
    console.error("[compare/activity]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "CONTRACT_ERROR" },
      { status: 500 },
    );
  }
}
