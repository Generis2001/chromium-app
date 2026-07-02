/**
 * Simulates one write call against each deployed GenLayer contract.
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

const calls = [
  {
    label: 'WeatherAnalysisContract',
    address: manifest.contracts.weatherAnalysis,
    functionName: 'analyze_weather',
    args: ['51.5074', '-0.1278', 'Is it good weather today?', 'London'],
  },
  {
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
  },
  {
    label: 'ActivityRiskContract',
    address: manifest.contracts.activityRisk,
    functionName: 'assess_activity',
    args: ['51.5074', '-0.1278', 'cycling', 'London', 'today', '2'],
  },
  {
    label: 'WeatherAlertContract',
    address: manifest.contracts.weatherAlert,
    functionName: 'check_alerts',
    args: ['51.5074', '-0.1278', 'London', '24'],
  },
];

async function main() {
  let passed = 0;

  for (const call of calls) {
    process.stdout.write(`${call.label.padEnd(30)} `);
    const raw = await client.simulateWriteContract({
      address: call.address,
      functionName: call.functionName,
      args: call.args,
    });
    if (raw === null || raw === undefined) {
      console.log('✓ simulated write completed');
    } else {
      const result = typeof raw === 'string' && raw.trim().startsWith('{') ? JSON.parse(raw) : raw;
      console.log(`✓ ${typeof result === 'object' ? Object.keys(result).slice(0, 5).join(', ') : String(result).slice(0, 80)}`);
    }
    passed++;
  }

  console.log(`\nResults: ${passed} passed, 0 failed`);
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
