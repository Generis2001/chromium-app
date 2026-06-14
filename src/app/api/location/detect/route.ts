import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, GeocodingResult } from "@/types";

const DEFAULT_LOCATION: GeocodingResult = {
  name: "London",
  display_name: "London, England, United Kingdom",
  lat: "51.5074",
  lon: "-0.1278",
  country: "United Kingdom",
  country_code: "gb",
  state: "England",
};

type IpapiResponse = {
  city: string;
  region: string;
  country_name: string;
  country_code: string;
  latitude: number;
  longitude: number;
  error?: boolean;
  reason?: string;
};

function extractIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  let raw = forwarded ?? realIp ?? "";

  raw = raw.split(",")[0].trim();
  raw = raw.replace(/^::ffff:/i, "");

  if (!raw || raw === "::1" || raw === "127.0.0.1") return "";

  return raw;
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<GeocodingResult>>> {
  const ip = extractIp(req);

  // No IP = running locally; return default
  if (!ip) {
    return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "chromium-weather/1.0" },
    });

    if (!res.ok) {
      return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
    }

    const ipData = (await res.json()) as IpapiResponse;

    if (ipData.error || !ipData.latitude) {
      return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
    }

    const result: GeocodingResult = {
      name: ipData.city || ipData.region || ipData.country_name,
      display_name: [ipData.city, ipData.region, ipData.country_name]
        .filter(Boolean)
        .join(", "),
      lat: String(ipData.latitude),
      lon: String(ipData.longitude),
      country: ipData.country_name,
      country_code: ipData.country_code.toLowerCase(),
      state: ipData.region || undefined,
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[location/detect]", err);
    return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
  }
}
