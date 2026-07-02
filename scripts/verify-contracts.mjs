/**
 * verify-contracts.mjs
 * Chromium — GenLayer Contract Verification
 *
 * Reads a view function from each deployed contract to confirm the contracts
 * are live and responding on studionet.
 *
 * Address resolution order:
 *   1. contracts/.deployed.json  (written by deploy-contracts.mjs)
 *   2. GENLAYER_*_ADDRESS env vars (from .env.local)
 *
 * Usage:
 *   node scripts/verify-contracts.mjs
 */

import { createClient, createAccount, chains } from 'genlayer-js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// ─── Paths ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Load environment ─────────────────────────────────────────────────────────
config({ path: resolve(ROOT, '.env.local') });

// ─── Resolve addresses ────────────────────────────────────────────────────────
function loadAddresses() {
  const jsonPath = resolve(ROOT, 'contracts', '.deployed.json');

  if (existsSync(jsonPath)) {
    try {
      const raw = readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(raw);
      const c = data.contracts ?? {};

      // Only use the JSON file if at least one real address is present
      const hasReal = Object.values(c).some(
        (v) => v && v !== null,
      );

      if (hasReal) {
        return {
          weatherAnalysis: c.weatherAnalysis ?? null,
          travelComparison: c.travelComparison ?? null,
          activityRisk: c.activityRisk ?? null,
          weatherAlert: c.weatherAlert ?? null,
          source: 'contracts/.deployed.json',
          deployedAt: data.deployedAt ?? null,
        };
      }
    } catch {
      // Fall through to env vars
    }
  }

  return {
    weatherAnalysis: process.env.GENLAYER_WEATHER_ANALYSIS_ADDRESS ?? null,
    travelComparison: process.env.GENLAYER_TRAVEL_COMPARISON_ADDRESS ?? null,
    activityRisk: process.env.GENLAYER_ACTIVITY_RISK_ADDRESS ?? null,
    weatherAlert: process.env.GENLAYER_WEATHER_ALERT_ADDRESS ?? null,
    source: '.env.local',
    deployedAt: null,
  };
}

// ─── Contract check definitions ───────────────────────────────────────────────
// Each entry describes one read-only view call.
// `expectedEmpty` means the contract starts with an empty-string default — we
// accept both "" and any non-null string as a passing result.
const CHECKS = [
  {
    key: 'weatherAnalysis',
    label: 'WeatherAnalysisContract',
    functionName: 'get_count',
    args: [],
    description: 'get_count() → u64',
    validate: (v) => v !== undefined && v !== null,
  },
  {
    key: 'travelComparison',
    label: 'TravelComparisonContract',
    functionName: 'get_comparison',
    args: [],
    description: 'get_comparison() → str',
    // Returns "" initially — that is a valid live response
    validate: (v) => v !== undefined && v !== null,
  },
  {
    key: 'activityRisk',
    label: 'ActivityRiskContract',
    functionName: 'get_assessment',
    args: [],
    description: 'get_assessment() → str',
    validate: (v) => v !== undefined && v !== null,
  },
  {
    key: 'weatherAlert',
    label: 'WeatherAlertContract',
    functionName: 'get_alert_count',
    args: [],
    description: 'get_alert_count() → u64',
    validate: (v) => v !== undefined && v !== null,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function banner(text) {
  const line = '─'.repeat(text.length + 4);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${text}  │`);
  console.log(`└${line}┘\n`);
}

async function checkContract(client, check, address) {
  if (!address) {
    return { ok: false, reason: 'address not set' };
  }

  try {
    const result = await client.readContract({
      address,
      functionName: check.functionName,
      args: check.args,
    });

    const ok = check.validate(result);
    return { ok, result };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  banner('Chromium — GenLayer Contract Verification');

  const addresses = loadAddresses();
  console.log(`Address source : ${addresses.source}`);
  if (addresses.deployedAt) {
    console.log(`Deployed at    : ${addresses.deployedAt}`);
  }
  console.log(`Network        : studionet\n`);

  // We only need a read-only client — no private key needed for view calls.
  // Use a dummy account if no private key is configured.
  const privateKey =
    process.env.GENLAYER_PRIVATE_KEY ??
    '0x0000000000000000000000000000000000000000000000000000000000000001';

  const account = createAccount(privateKey);
  const client = createClient({
    chain: chains.studionet,
    account,
  });

  let passed = 0;
  let failed = 0;

  for (const check of CHECKS) {
    const address = addresses[check.key];
    process.stdout.write(
      `  ${check.label.padEnd(30)} ${check.description.padEnd(30)} `,
    );

    if (!address) {
      console.log(`✗  (address not configured)`);
      failed++;
      continue;
    }

    const { ok, result, reason } = await checkContract(client, check, address);

    if (ok) {
      const display =
        result === '' ? '(empty string — contract freshly deployed)'
        : String(result).slice(0, 60);
      console.log(`✓  ${display}`);
      passed++;
    } else {
      console.log(`✗  ${reason ?? 'validation failed'}`);
      failed++;
    }
  }

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
