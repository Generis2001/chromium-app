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

type IpApiResponse = {
  status: string;
  country: string;
  countryCode: string;
  regionName: string;
  city: string;
  lat: number;
  lon: number;
};

function extractIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  let raw = forwarded ?? realIp ?? "1.1.1.1";

  raw = raw.split(",")[0].trim();
  raw = raw.replace(/^::ffff:/i, "");

  if (!raw || raw === "::1" || raw === "127.0.0.1") {
    return "1.1.1.1";
  }

  return raw;
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<GeocodingResult>>> {
  const ip = extractIp(req);

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,lat,lon`,
    );

    if (!res.ok) {
      return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
    }

    const ipData = (await res.json()) as IpApiResponse;

    if (ipData.status !== "success") {
      return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
    }

    const result: GeocodingResult = {
      name: ipData.city || ipData.regionName || ipData.country,
      display_name: [ipData.city, ipData.regionName, ipData.country]
        .filter(Boolean)
        .join(", "),
      lat: String(ipData.lat),
      lon: String(ipData.lon),
      country: ipData.country,
      country_code: ipData.countryCode.toLowerCase(),
      state: ipData.regionName || undefined,
    };

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error("[location/detect]", err);
    return NextResponse.json({ ok: true, data: DEFAULT_LOCATION });
  }
}
