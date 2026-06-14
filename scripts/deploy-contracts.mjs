/**
 * deploy-contracts.mjs
 * Chromium — GenLayer Contract Deployment
 *
 * Deploys all 4 Intelligent Contracts to testnetBradbury in sequence,
 * waits for FINALIZED status on each, then prints the resulting addresses
 * and writes contracts/.deployed.json.
 *
 * Usage:
 *   node scripts/deploy-contracts.mjs
 *
 * Required env vars (in .env.local):
 *   GENLAYER_PRIVATE_KEY   — deployer private key  (0x-prefixed hex)
 */

import { createClient, createAccount, chains } from 'genlayer-js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// TransactionStatus is not in the public API — use the stable string value directly
const TransactionStatus = { FINALIZED: 'FINALIZED' };

// ─── Paths ────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Load environment ─────────────────────────────────────────────────────────
config({ path: resolve(ROOT, '.env.local') });

const PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('ERROR: GENLAYER_PRIVATE_KEY is not set in .env.local');
  process.exit(1);
}

// ─── Contract definitions ─────────────────────────────────────────────────────
const CONTRACTS = [
  {
    key: 'weatherAnalysis',
    label: 'WeatherAnalysisContract',
    envKey: 'GENLAYER_WEATHER_ANALYSIS_ADDRESS',
    file: resolve(ROOT, 'contracts', 'weather_analysis.py'),
  },
  {
    key: 'travelComparison',
    label: 'TravelComparisonContract',
    envKey: 'GENLAYER_TRAVEL_COMPARISON_ADDRESS',
    file: resolve(ROOT, 'contracts', 'travel_comparison.py'),
  },
  {
    key: 'activityRisk',
    label: 'ActivityRiskContract',
    envKey: 'GENLAYER_ACTIVITY_RISK_ADDRESS',
    file: resolve(ROOT, 'contracts', 'activity_risk.py'),
  },
  {
    key: 'weatherAlert',
    label: 'WeatherAlertContract',
    envKey: 'GENLAYER_WEATHER_ALERT_ADDRESS',
    file: resolve(ROOT, 'contracts', 'weather_alert.py'),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function banner(text) {
  const line = '─'.repeat(text.length + 4);
  console.log(`\n┌${line}┐`);
  console.log(`│  ${text}  │`);
  console.log(`└${line}┘\n`);
}

async function deployOne(client, account, contract) {
  const code = readFileSync(contract.file, 'utf8');

  console.log(`Deploying ${contract.label}...`);

  let txHash;
  try {
    txHash = await client.deployContract({
      account,
      code,
      args: [],
    });
  } catch (err) {
    throw new Error(`deployContract failed for ${contract.label}: ${err.message}`);
  }

  console.log(`  tx hash: ${txHash}`);
  console.log(`  Waiting for FINALIZED status (up to 2 minutes)...`);

  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      interval: 2000,
      retries: 60,
    });
  } catch (err) {
    throw new Error(
      `waitForTransactionReceipt failed for ${contract.label}: ${err.message}`,
    );
  }

  // The deployed contract address is stored in to_address / recipient on the
  // finalized GenLayerTransaction.  Fall back to fetching the transaction
  // explicitly if the receipt doesn't carry it directly.
  let address =
    receipt.to_address ||
    receipt.recipient ||
    receipt.contractAddress ||
    receipt.to ||
    null;

  if (!address) {
    // Fetch full transaction data to obtain the address
    const tx = await client.getTransaction({ hash: txHash });
    address =
      tx.to_address ||
      tx.recipient ||
      tx.contractAddress ||
      tx.to ||
      null;
  }

  if (!address) {
    throw new Error(
      `Could not determine deployed address for ${contract.label}. ` +
        `Receipt keys: ${Object.keys(receipt).join(', ')}`,
    );
  }

  console.log(`  ✓ Deployed at ${address}\n`);
  return address;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  banner('Chromium — GenLayer Contract Deployment');

  console.log(`Network : studionet`);
  console.log(`RPC     : ${chains.studionet.rpcUrls?.default?.http?.[0] ?? '(default)'}\n`);

  const account = createAccount(PRIVATE_KEY);
  console.log(`Deployer: ${account.address}\n`);

  const client = createClient({
    chain: chains.studionet,
    account,
  });

  const deployed = {};

  for (const contract of CONTRACTS) {
    try {
      deployed[contract.key] = await deployOne(client, account, contract);
    } catch (err) {
      console.error(`\n✗ ERROR: ${err.message}`);
      process.exit(1);
    }
  }

  // ─── Print env block ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('Add these to your .env.local:\n');
  for (const contract of CONTRACTS) {
    console.log(`${contract.envKey}=${deployed[contract.key]}`);
  }
  console.log('══════════════════════════════════════════════════════════════\n');

  // ─── Write .deployed.json ───────────────────────────────────────────────────
  const deployedJson = {
    deployedAt: new Date().toISOString(),
    network: 'studionet',
    contracts: {
      weatherAnalysis: deployed.weatherAnalysis,
      travelComparison: deployed.travelComparison,
      activityRisk: deployed.activityRisk,
      weatherAlert: deployed.weatherAlert,
    },
  };

  const outPath = resolve(ROOT, 'contracts', '.deployed.json');
  writeFileSync(outPath, JSON.stringify(deployedJson, null, 2) + '\n', 'utf8');
  console.log(`Deployment manifest written to contracts/.deployed.json\n`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
