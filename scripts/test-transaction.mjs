/**
 * test-transaction.mjs
 * Fires a single analyze_weather write transaction against WeatherAnalysisContract
 * on studionet and waits for FINALIZED status, then prints the tx hash for
 * verification in the GenLayer explorer.
 */

import { createClient, createAccount, chains } from 'genlayer-js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
config({ path: resolve(ROOT, '.env.local') });

const PRIVATE_KEY = process.env.GENLAYER_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.GENLAYER_WEATHER_ANALYSIS_ADDRESS;

if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error('Missing GENLAYER_PRIVATE_KEY or GENLAYER_WEATHER_ANALYSIS_ADDRESS');
  process.exit(1);
}

const GEN = BigInt('500000000000000000'); // 0.5 GEN in wei

async function main() {
  const account = createAccount(PRIVATE_KEY);
  const client = createClient({ chain: chains.studionet, account });

  console.log(`\nAccount  : ${account.address}`);
  console.log(`Contract : ${CONTRACT_ADDRESS}`);
  console.log(`\nCalling analyze_weather(London)...`);

  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: 'analyze_weather',
    args: ['51.5074', '-0.1278', 'Is it good weather today?', 'London'],
    value: GEN,
  });

  console.log(`\nTx hash  : ${txHash}`);
  console.log(`Explorer : https://explorer-studio.genlayer.com/tx/${txHash}`);
  console.log(`\nWaiting for FINALIZED status (up to 3 minutes)...`);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: 'FINALIZED',
    interval: 3000,
    retries: 60,
  });

  console.log(`\nStatus   : ${receipt.status ?? receipt.consensus_data?.final_verdict ?? 'unknown'}`);
  console.log(`\nFull receipt keys: ${Object.keys(receipt).join(', ')}`);

  const verdict = receipt.consensus_data?.final_verdict ?? receipt.execution_result ?? receipt.result_code;
  if (verdict) console.log(`Verdict  : ${verdict}`);

  console.log('\nDone. Check the explorer link above for GenVM Execution details.');
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
