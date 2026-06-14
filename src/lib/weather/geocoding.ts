/**
 * Geocoding service using Open-Meteo's Geocoding API (free, no key required).
 * Falls back to Nominatim (OpenStreetMap) for richer place data.
 */

import type { GeocodingResult } from "@/types";

const OPEN_METEO_GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

export async function geocodeLocation(
  query: string,
  limit = 5,
): Promise<GeocodingResult[]> {
  // Try Open-Meteo geocoding first
  const omUrl = `${OPEN_METEO_GEO_URL}?name=${encodeURIComponent(query)}&count=${limit}&language=en&format=json`;

  const res = await fetch(omUrl, {
    headers: { "User-Agent": "Chromium-Weather/1.0" },
    next: { revalidate: 3600 }, // cache 1 hour
  });

  if (!res.ok) {
    throw new Error(`Geocoding API error: ${res.status}`);
  }

  const data = await res.json();
  const results: GeocodingResult[] = (data.results || []).map(
    (r: {
      name: string;
      country: string;
      country_code: string;
      admin1?: string;
      latitude: number;
      longitude: number;
    }) => ({
      name: r.name,
      display_name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
      lat: String(r.latitude),
      lon: String(r.longitude),
      country: r.country || "",
      country_code: r.country_code?.toLowerCase() || "",
      state: r.admin1,
    }),
  );

  return results;
}

export async function reverseGeocode(
  lat: string,
  lon: string,
): Promise<GeocodingResult | null> {
  const url = `${NOMINATIM_REVERSE_URL}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Chromium-Weather/1.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;

    // Nominatim returns { error: "..." } when coordinates are invalid
    if (!data || "error" in data) return null;

    const addr = (data.address as Record<string, string>) ?? {};
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? (data.name as string) ?? "";
    const state = addr.state ?? addr.county ?? "";
    const country = addr.country ?? "";
    const country_code = (addr.country_code ?? "").toLowerCase();

    return {
      name: city,
      display_name: [city, state, country].filter(Boolean).join(", "),
      lat: String(data.lat),
      lon: String(data.lon),
      country,
      country_code,
      state,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a natural language query to extract location names.
 * Simple heuristic — strips common weather phrases so we geocode the place part.
 */
export function extractLocationFromQuery(query: string): string {
  const normalised = query.toLowerCase();

  // Patterns: "weather in X", "will it rain in X", "is it safe to X in X"
  const patterns = [
    /(?:weather|forecast|rain|snow|storm|temperature|wind)\s+(?:in|at|for|near)\s+(.+)/i,
    /(?:should i|can i|is it safe to|best time to)\s+.+\s+(?:in|at|near)\s+(.+)/i,
    /(?:travel|visit|go to|fly to|drive to)\s+(.+)/i,
    /(?:in|at|near)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = normalised.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/[?.!]$/, "");
    }
  }

  // Fallback: if query looks like a place name directly
  if (query.length < 50 && !query.includes(" ")) {
    return query;
  }

  // Last resort: return last "word group" after common verbs
  return query.trim();
}
