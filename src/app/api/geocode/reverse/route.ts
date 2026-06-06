import { NextRequest, NextResponse } from "next/server";
import { reverseGeocode } from "@/lib/weather/geocoding";
import type { ApiResponse, GeocodingResult } from "@/types";

const COORD_RE = /^-?\d+(\.\d+)?$/;

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<GeocodingResult>>> {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat")?.trim();
  const lon = searchParams.get("lon")?.trim();

  if (!lat || !lon || !COORD_RE.test(lat) || !COORD_RE.test(lon)) {
    return NextResponse.json(
      { ok: false, error: "Valid numeric lat and lon are required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  try {
    const result = await reverseGeocode(lat, lon);

    if (!result) {
      const fallback: GeocodingResult = {
        name: "Unknown Location",
        display_name: "Unknown Location",
        lat,
        lon,
        country: "",
        country_code: "",
      };
      return NextResponse.json({ ok: true, data: fallback });
    }

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reverse geocoding failed";
    console.error("[geocode/reverse]", err);
    return NextResponse.json(
      { ok: false, error: message, code: "GEOCODING_ERROR" },
      { status: 500 },
    );
  }
}
