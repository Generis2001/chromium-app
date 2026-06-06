/**
 * Neon Postgres client + schema helpers for Chromium.
 *
 * Schema:
 *   saved_locations  — user-bookmarked locations
 *   weather_queries  — history of user queries
 *   contract_results — cached GenLayer contract outputs
 *   activity_recs    — cached activity assessments
 *   alert_records    — stored alert notifications
 *
 * We use @neondatabase/serverless for edge-compatible connection pooling.
 */

import { neon } from "@neondatabase/serverless";
import type { AiExplanation } from "@/types";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(url);
}

export const sql = getSql;

// ─── schema initialisation (run once via /api/setup or migration) ─────────────
export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS saved_locations (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  display_name TEXT NOT NULL,
  lat         TEXT NOT NULL,
  lon         TEXT NOT NULL,
  country     TEXT,
  country_code TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weather_queries (
  id           SERIAL PRIMARY KEY,
  query        TEXT NOT NULL,
  location     TEXT NOT NULL,
  lat          TEXT NOT NULL,
  lon          TEXT NOT NULL,
  decision     TEXT,
  risk_level   TEXT,
  confidence   INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_queries_location
  ON weather_queries (location, created_at DESC);

CREATE TABLE IF NOT EXISTS contract_results (
  id              SERIAL PRIMARY KEY,
  contract_type   TEXT NOT NULL,  -- weather_analysis | travel_comparison | activity_risk | weather_alert
  location        TEXT NOT NULL,
  lat             TEXT NOT NULL,
  lon             TEXT NOT NULL,
  input_hash      TEXT NOT NULL,  -- SHA-256 of input params for cache lookup
  result_json     JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_results_lookup
  ON contract_results (contract_type, input_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_recs (
  id             SERIAL PRIMARY KEY,
  activity       TEXT NOT NULL,
  location       TEXT NOT NULL,
  lat            TEXT NOT NULL,
  lon            TEXT NOT NULL,
  target_date    TEXT NOT NULL,
  risk_level     TEXT,
  risk_score     INTEGER,
  suitability    TEXT,
  result_json    JSONB NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_records (
  id              SERIAL PRIMARY KEY,
  location        TEXT NOT NULL,
  lat             TEXT NOT NULL,
  lon             TEXT NOT NULL,
  overall_severity TEXT NOT NULL,
  alert_count     INTEGER NOT NULL,
  alerts_json     JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_records_location
  ON alert_records (location, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_explanations (
  id               SERIAL PRIMARY KEY,
  contract_type    TEXT NOT NULL,
  input_hash       TEXT NOT NULL,
  explanation_json JSONB NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_explanations_lookup
  ON ai_explanations (contract_type, input_hash, created_at DESC);
`;

// ─── cache helpers ────────────────────────────────────────────────────────────
export async function getCachedContractResult(
  contractType: string,
  inputHash: string,
  maxAgeMinutes = 30,
): Promise<Record<string, unknown> | null> {
  const db = sql();
  const rows = await db`
    SELECT result_json FROM contract_results
    WHERE contract_type = ${contractType}
      AND input_hash = ${inputHash}
      AND created_at > NOW() - INTERVAL '1 minute' * ${maxAgeMinutes}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rows[0].result_json as Record<string, unknown>;
}

export async function cacheContractResult(
  contractType: string,
  location: string,
  lat: string,
  lon: string,
  inputHash: string,
  result: unknown,
  ttlMinutes = 30,
): Promise<void> {
  const db = sql();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  await db`
    INSERT INTO contract_results
      (contract_type, location, lat, lon, input_hash, result_json, expires_at)
    VALUES
      (${contractType}, ${location}, ${lat}, ${lon}, ${inputHash},
       ${JSON.stringify(result)}, ${expiresAt})
  `;
}

export async function logWeatherQuery(params: {
  query: string;
  location: string;
  lat: string;
  lon: string;
  decision?: string;
  risk_level?: string;
  confidence?: number;
}): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO weather_queries
      (query, location, lat, lon, decision, risk_level, confidence)
    VALUES
      (${params.query}, ${params.location}, ${params.lat}, ${params.lon},
       ${params.decision ?? null}, ${params.risk_level ?? null},
       ${params.confidence ?? null})
  `;
}

export async function saveLocation(params: {
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  country?: string;
  country_code?: string;
}): Promise<number> {
  const db = sql();
  const rows = await db`
    INSERT INTO saved_locations
      (name, display_name, lat, lon, country, country_code)
    VALUES
      (${params.name}, ${params.display_name}, ${params.lat}, ${params.lon},
       ${params.country ?? null}, ${params.country_code ?? null})
    RETURNING id
  `;
  return rows[0].id as number;
}

// ─── AI explanation cache ───────────────────────────────────────────────────────
export async function getCachedExplanation(
  contractType: string,
  inputHash: string,
  maxAgeMinutes = 1440, // 24 hours
): Promise<AiExplanation | null> {
  const db = sql();
  const rows = await db`
    SELECT explanation_json FROM ai_explanations
    WHERE contract_type = ${contractType}
      AND input_hash = ${inputHash}
      AND created_at > NOW() - INTERVAL '1 minute' * ${maxAgeMinutes}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rows[0].explanation_json as unknown as AiExplanation;
}

export async function cacheExplanation(
  contractType: string,
  inputHash: string,
  explanation: AiExplanation,
  ttlMinutes = 1440,
): Promise<void> {
  const db = sql();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  await db`
    INSERT INTO ai_explanations
      (contract_type, input_hash, explanation_json, expires_at)
    VALUES
      (${contractType}, ${inputHash}, ${JSON.stringify(explanation)}, ${expiresAt})
  `;
}

export async function getSavedLocations(): Promise<
  Array<{
    id: number;
    name: string;
    display_name: string;
    lat: string;
    lon: string;
    country: string;
    country_code: string;
  }>
> {
  const db = sql();
  const rows = await db`
    SELECT id, name, display_name, lat, lon, country, country_code
    FROM saved_locations
    ORDER BY created_at DESC
    LIMIT 20
  `;
  return rows as Array<{
    id: number;
    name: string;
    display_name: string;
    lat: string;
    lon: string;
    country: string;
    country_code: string;
  }>;
}
