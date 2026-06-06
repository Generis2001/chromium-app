/**
 * setup-db.mjs
 * Chromium — Neon Postgres Schema Initialisation
 *
 * Connects to the Neon Postgres database specified in DATABASE_URL and creates
 * all five application tables (if they do not already exist):
 *
 *   saved_locations   — user-bookmarked locations
 *   weather_queries   — history of user queries
 *   contract_results  — cached GenLayer contract outputs
 *   activity_recs     — cached activity assessments
 *   alert_records     — stored alert notifications
 *
 * Usage:
 *   node scripts/setup-db.mjs
 *
 * Required env vars (in .env.local):
 *   DATABASE_URL  — Neon connection string, e.g.
 *                   postgres://user:pass@host.neon.tech/chromium?sslmode=require
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// ─── Paths ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Load environment ─────────────────────────────────────────────────────────
config({ path: resolve(ROOT, '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env.local');
  process.exit(1);
}

// ─── Schema SQL (mirrors src/lib/db/index.ts :: SCHEMA_SQL) ──────────────────
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS saved_locations (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  lat          TEXT NOT NULL,
  lon          TEXT NOT NULL,
  country      TEXT,
  country_code TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
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
  id            SERIAL PRIMARY KEY,
  contract_type TEXT NOT NULL,
  location      TEXT NOT NULL,
  lat           TEXT NOT NULL,
  lon           TEXT NOT NULL,
  input_hash    TEXT NOT NULL,
  result_json   JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_results_lookup
  ON contract_results (contract_type, input_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_recs (
  id          SERIAL PRIMARY KEY,
  activity    TEXT NOT NULL,
  location    TEXT NOT NULL,
  lat         TEXT NOT NULL,
  lon         TEXT NOT NULL,
  target_date TEXT NOT NULL,
  risk_level  TEXT,
  risk_score  INTEGER,
  suitability TEXT,
  result_json JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_records (
  id               SERIAL PRIMARY KEY,
  location         TEXT NOT NULL,
  lat              TEXT NOT NULL,
  lon              TEXT NOT NULL,
  overall_severity TEXT NOT NULL,
  alert_count      INTEGER NOT NULL,
  alerts_json      JSONB NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function banner(text) {
  const line = '─'.repeat(text.length + 4);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${text}  │`);
  console.log(`└${line}┘\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  banner('Chromium — Neon Postgres Schema Initialisation');

  // Dynamic import so the module resolves at runtime with the correct env
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DATABASE_URL);

  console.log('Connecting to Neon Postgres...');
  console.log(`Host: ${new URL(DATABASE_URL).host}\n`);

  // Split on statement terminators and run each individually.
  // neon() does not support multi-statement strings in a single tagged call.
  const statements = SCHEMA_SQL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const tables = [
    'saved_locations',
    'weather_queries',
    'contract_results',
    'activity_recs',
    'alert_records',
    'ai_explanations',
  ];

  let statementIndex = 0;
  for (const stmt of statements) {
    // Identify what we're creating for user-friendly output
    const tableMatch = stmt.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);
    const indexMatch = stmt.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)/i);

    try {
      await sql.unsafe(stmt);

      if (tableMatch) {
        console.log(`  ✓ Table  : ${tableMatch[1]}`);
      } else if (indexMatch) {
        console.log(`  ✓ Index  : ${indexMatch[1]}`);
      }
    } catch (err) {
      const label = tableMatch?.[1] ?? indexMatch?.[1] ?? `statement ${statementIndex + 1}`;
      console.error(`  ✗ Failed : ${label}`);
      console.error(`    ${err.message}`);
      process.exit(1);
    }

    statementIndex++;
  }

  console.log('\nDatabase schema initialised\n');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
