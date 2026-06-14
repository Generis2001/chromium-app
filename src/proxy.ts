import { NextRequest, NextResponse } from "next/server";

// ─── In-memory sliding-window rate limiter ────────────────────────────────────
// Suitable for single-instance deployments. For multi-instance, swap to Redis.

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 60; // per IP per window

type WindowEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, WindowEntry>();

// Periodically purge expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60_000);

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    store.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Only rate-limit API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Health and address endpoints are exempt — they're cheap reads
  if (
    pathname === "/api/contracts/health" ||
    pathname === "/api/contracts/addresses"
  ) {
    return NextResponse.next();
  }

  const ip = getClientIp(req);
  const { allowed, remaining, resetAt } = checkRateLimit(ip);

  const res = allowed ? NextResponse.next() : NextResponse.json(
    { ok: false, error: "Too many requests", code: "RATE_LIMITED" },
    { status: 429 },
  );

  res.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.headers.set("X-RateLimit-Remaining", String(remaining));
  res.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
