/**
 * Sends one write transaction to each deployed GenLayer contract on Studionet
 * and confirms the corresponding view function returns data afterward.
 */

import { createAccount, createClient, chains } from 'genlayer-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
config({ path: resolve(ROOT, '.env.local') });

const PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('Missing GENLAYER_PRIVATE_KEY');
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(resolve(ROOT, 'contracts', '.deployed.json'), 'utf8'),
);

const account = createAccount(PRIVATE_KEY);
const client = createClient({ chain: chains.studionet, account });
const GEN = BigInt('500000000000000000');

const checks = [
  {
    key: 'weatherAnalysis',
    label: 'WeatherAnalysisContract',
    address: manifest.contracts.weatherAnalysis,
    functionName: 'analyze_weather',
    args: ['51.5074', '-0.1278', 'Is it good weather today?', 'London'],
    value: GEN,
    viewName: 'get_analysis',
  },
  {
    key: 'travelComparison',
    label: 'TravelComparisonContract',
    address: manifest.contracts.travelComparison,
    functionName: 'compare_locations',
    args: [
      JSON.stringify([
        { name: 'London', lat: '51.5074', lon: '-0.1278' },
        { name: 'Paris', lat: '48.8566', lon: '2.3522' },
      ]),
      'travel',
      'today',
    ],
    value: BigInt('1000000000000000000'),
    viewName: 'get_comparison',
  },
  {
    key: 'activityRisk',
    label: 'ActivityRiskContract',
    address: manifest.contracts.activityRisk,
    functionName: 'assess_activity',
    args: ['51.5074', '-0.1278', 'cycling', 'London', 'today', '2'],
    value: GEN,
    viewName: 'get_assessment',
  },
  {
    key: 'weatherAlert',
    label: 'WeatherAlertContract',
    address: manifest.contracts.weatherAlert,
    functionName: 'check_alerts',
    args: ['51.5074', '-0.1278', 'London', '24'],
    value: GEN,
    viewName: 'get_alerts',
  },
];

async function runCheck(check) {
  console.log(`\n${check.label}`);
  console.log(`  Address : ${check.address}`);

  const txHash = await client.writeContract({
    address: check.address,
    functionName: check.functionName,
    args: check.args,
    value: check.value,
  });

  console.log(`  Tx      : ${txHash}`);
  console.log(`  Explorer: https://explorer-studio.genlayer.com/tx/${txHash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: 'FINALIZED',
    interval: 10000,
    retries: 40,
  });

  console.log(`  Status  : ${receipt.status ?? receipt.consensus_data?.final_verdict ?? 'unknown'}`);

  const stored = await client.readContract({
    address: check.address,
    functionName: check.viewName,
    args: [],
  });

  if (typeof stored !== 'string' || stored.length === 0) {
    throw new Error(`${check.label} returned empty stored result after write`);
  }

  JSON.parse(stored);
  console.log(`  Result  : JSON stored (${stored.length} chars)`);
}

async function main() {
  console.log(`Account : ${account.address}`);
  console.log(`Network : studionet`);

  for (const check of checks) {
    await runCheck(check);
  }

  console.log('\nAll contract write paths finalized and returned JSON.');
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
