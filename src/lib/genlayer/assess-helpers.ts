import { createHash } from "crypto";
import { invokeActivityRisk } from "./client";
import { getCachedContractResult, cacheContractResult } from "@/lib/db";
import type { ActivityAssessment } from "@/types";

export async function assessActivityWithCache(params: {
  lat: string;
  lon: string;
  activity: string;
  location_name: string;
  target_date: string;
  duration_hours: string;
}): Promise<ActivityAssessment> {
  const { lat, lon, activity, location_name, target_date, duration_hours } =
    params;

  const inputHash = createHash("sha256")
    .update(`${lat}:${lon}:${activity}:${target_date}:${duration_hours}`)
    .digest("hex");

  try {
    const cached = await getCachedContractResult(
      "activity_risk",
      inputHash,
      20,
    );
    if (cached) {
      return cached as unknown as ActivityAssessment;
    }
  } catch {
    // cache miss — proceed to contract
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

  return result;
}
