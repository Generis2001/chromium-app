/**
 * POST /api/activity
 *
 * Invokes ActivityRiskContract — assesses weather risk for a specific activity.
 *
 * Body: { lat, lon, activity, location_name, target_date, duration_hours }
 */

export const maxDuration = 150;

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { invokeActivityRisk } from "@/lib/genlayer/client";
import { getCachedContractResult, cacheContractResult } from "@/lib/db";
import type { ActivityAssessment, ApiResponse } from "@/types";
import { SUPPORTED_ACTIVITIES } from "@/types";

const BodySchema = z.object({
  lat: z.string().regex(/^-?\d+(\.\d+)?$/),
  lon: z.string().regex(/^-?\d+(\.\d+)?$/),
  activity: z.enum(SUPPORTED_ACTIVITIES),
  location_name: z.string().min(1).max(200),
  target_date: z.string().min(1).max(20),
  duration_hours: z.string().regex(/^\d+$/).default("4"),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ActivityAssessment>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { lat, lon, activity, location_name, target_date, duration_hours } =
      parsed.data;

    const inputHash = createHash("sha256")
      .update(`${lat}:${lon}:${activity}:${target_date}:${duration_hours}`)
      .digest("hex");

    let cached: Record<string, unknown> | null = null;
    try {
      cached = await getCachedContractResult("activity_risk", inputHash, 20);
    } catch {
      // proceed
    }

    if (cached) {
      return NextResponse.json({
        ok: true,
        data: cached as unknown as ActivityAssessment,
        cached: true,
      });
    }

    const result = await invokeActivityRisk({
      lat,
      lon,
      activity,
      location_name,
      target_date,
      duration_hours,
    });

    try {
      await cacheContractResult(
        "activity_risk",
        location_name,
        lat,
        lon,
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
    console.error("[activity]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "CONTRACT_ERROR" },
      { status: 500 },
    );
  }
}
