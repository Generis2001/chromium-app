export const maxDuration = 150;

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { assessActivityWithCache } from "@/lib/genlayer/assess-helpers";
import { getCachedContractResult, cacheContractResult } from "@/lib/db";
import { SUPPORTED_ACTIVITIES } from "@/types";
import type { BestDateResult, DateRanking, ApiResponse } from "@/types";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function addDays(baseDate: Date, days: number): string {
  const d = new Date(baseDate);
  d.setDate(baseDate.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return DAY_NAMES[d.getUTCDay()];
}

const BodySchema = z.object({
  lat: z.string().regex(/^-?\d+(\.\d+)?$/),
  lon: z.string().regex(/^-?\d+(\.\d+)?$/),
  activity: z.enum(SUPPORTED_ACTIVITIES),
  location_name: z.string().min(1).max(200),
  duration_hours: z.string().regex(/^\d+$/).default("4"),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<BestDateResult>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { lat, lon, activity, location_name, duration_hours } = parsed.data;

    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i));

    const inputHash = createHash("sha256")
      .update(
        `${lat}:${lon}:${activity}:${duration_hours}:${dates[0]}`,
      )
      .digest("hex");

    try {
      const cached = await getCachedContractResult(
        "activity_best_date",
        inputHash,
        20,
      );
      if (cached) {
        return NextResponse.json({
          ok: true,
          data: cached as unknown as BestDateResult,
          cached: true,
        });
      }
    } catch {
      // proceed
    }

    const assessments = await Promise.allSettled(
      dates.map((date) =>
        assessActivityWithCache({
          lat,
          lon,
          activity,
          location_name,
          target_date: date,
          duration_hours,
        }),
      ),
    );

    const ranked: DateRanking[] = [];

    assessments.forEach((outcome, i) => {
      if (outcome.status === "rejected") return;
      const a = outcome.value;
      ranked.push({
        date: dates[i],
        day_name: getDayName(dates[i]),
        rank: 0,
        overall_score: 100 - a.risk_score,
        suitability: a.suitability,
        risk_level: a.risk_level,
        risk_score: a.risk_score,
        condition_summary: a.recommendation,
      });
    });

    if (ranked.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not assess any dates",
          code: "CONTRACT_ERROR",
        },
        { status: 500 },
      );
    }

    ranked.sort((a, b) => b.overall_score - a.overall_score);
    ranked.forEach((r, i) => {
      r.rank = i + 1;
    });

    const best = ranked[0];
    const result: BestDateResult = {
      best_date: best.date,
      best_day_name: best.day_name,
      reasoning: `${best.day_name} (${best.date}) has the best conditions for ${activity} with a safety score of ${best.overall_score}/100.`,
      ranked_dates: ranked,
      activity,
    };

    try {
      await cacheContractResult(
        "activity_best_date",
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
      err instanceof Error ? err.message : "Best-date finder failed";
    console.error("[activity/best-date]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "CONTRACT_ERROR" },
      { status: 500 },
    );
  }
}
