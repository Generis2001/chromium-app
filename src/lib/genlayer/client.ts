import {
  createClient,
  createAccount,
  chains,
} from "genlayer-js";

// TransactionStatus is not exported from the genlayer-js public API.
// The FINALIZED string value is stable across versions.
const TransactionStatus = { FINALIZED: "FINALIZED" } as const;
import type {
  WeatherDecision,
  ComparisonResult,
  ActivityAssessment,
  AlertsResult,
} from "@/types";
import {
  CircuitOpenError,
  ContractValidationError,
  classifyError,
} from "./errors";

const { testnetBradbury } = chains;

// ─── contract addresses ──────────────────────────────────────────────────────
const CONTRACT_ADDRESSES = {
  weatherAnalysis: (process.env.GENLAYER_WEATHER_ANALYSIS_ADDRESS ||
    "0x0000000000000000000000000000000000000001") as `0x${string}`,
  travelComparison: (process.env.GENLAYER_TRAVEL_COMPARISON_ADDRESS ||
    "0x0000000000000000000000000000000000000002") as `0x${string}`,
  activityRisk: (process.env.GENLAYER_ACTIVITY_RISK_ADDRESS ||
    "0x0000000000000000000000000000000000000003") as `0x${string}`,
  weatherAlert: (process.env.GENLAYER_WEATHER_ALERT_ADDRESS ||
    "0x0000000000000000000000000000000000000004") as `0x${string}`,
} as const;

// ─── circuit breaker state ───────────────────────────────────────────────────
type CircuitState = {
  status: "CLOSED" | "OPEN" | "HALF_OPEN";
  failures: number;
  openedAt: number | null;
};

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000;

const circuitMap = new Map<string, CircuitState>();

function getCircuit(contractName: string): CircuitState {
  if (!circuitMap.has(contractName)) {
    circuitMap.set(contractName, {
      status: "CLOSED",
      failures: 0,
      openedAt: null,
    });
  }
  return circuitMap.get(contractName)!;
}

function recordSuccess(contractName: string): void {
  circuitMap.set(contractName, {
    status: "CLOSED",
    failures: 0,
    openedAt: null,
  });
}

function recordFailure(contractName: string): void {
  const state = getCircuit(contractName);
  const failures = state.failures + 1;

  if (failures >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitMap.set(contractName, {
      status: "OPEN",
      failures,
      openedAt: Date.now(),
    });
  } else {
    circuitMap.set(contractName, { ...state, failures });
  }
}

function checkCircuit(contractName: string): void {
  const state = getCircuit(contractName);

  if (state.status === "CLOSED") return;

  if (state.status === "OPEN") {
    const elapsed = Date.now() - (state.openedAt ?? 0);
    if (elapsed >= CIRCUIT_RESET_MS) {
      // Transition to half-open: allow exactly one probe attempt
      circuitMap.set(contractName, {
        ...state,
        status: "HALF_OPEN",
      });
      return;
    }
    throw new CircuitOpenError(contractName);
  }

  // HALF_OPEN: let the call through; outcome handled by recordSuccess/recordFailure
}

export function getCircuitStatus(): Record<string, CircuitState> {
  return Object.fromEntries(circuitMap.entries());
}

export function resetCircuit(contractName: string): void {
  circuitMap.set(contractName, {
    status: "CLOSED",
    failures: 0,
    openedAt: null,
  });
}

// ─── retry with exponential backoff + jitter ─────────────────────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Do not retry validation-class errors — they will not resolve on retry
      if (err instanceof ContractValidationError) throw err;
      if (err instanceof CircuitOpenError) throw err;

      // Also classify raw errors before deciding — skip retry for 4xx-equivalent
      const classified = classifyError(err, "");
      if (classified instanceof ContractValidationError) throw classified;

      if (attempt < maxAttempts) {
        const delay =
          baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ─── client factory (server-side only) ──────────────────────────────────────
function getClient() {
  const privateKey = process.env.GENLAYER_PRIVATE_KEY as
    | `0x${string}`
    | undefined;

  if (!privateKey) {
    throw new Error("GENLAYER_PRIVATE_KEY is not set");
  }

  const account = createAccount(privateKey);

  return createClient({
    chain: testnetBradbury,
    account,
  });
}

// ─── transaction finality helper ─────────────────────────────────────────────
async function waitForFinality(
  client: ReturnType<typeof getClient>,
  txHash: string,
  timeoutMs = 120_000,
): Promise<void> {
  await client.waitForTransactionReceipt({
    hash: txHash as Parameters<typeof client.waitForTransactionReceipt>[0]["hash"],
    status: (TransactionStatus?.FINALIZED ?? "FINALIZED") as Parameters<
      typeof client.waitForTransactionReceipt
    >[0]["status"],
    interval: 2000,
    retries: Math.ceil(timeoutMs / 2000),
  });
}

// ─── WeatherAnalysisContract ─────────────────────────────────────────────────
export async function invokeWeatherAnalysis(params: {
  lat: string;
  lon: string;
  query: string;
  location_name: string;
}): Promise<WeatherDecision> {
  const contractName = "weatherAnalysis";
  checkCircuit(contractName);

  try {
    const result = await withRetry(async () => {
      const client = getClient();

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.weatherAnalysis,
        functionName: "analyze_weather",
        args: [params.lat, params.lon, params.query, params.location_name],
        value: BigInt(0),
      });

      await waitForFinality(client, txHash as `0x${string}`);

      const raw = await client.readContract({
        address: CONTRACT_ADDRESSES.weatherAnalysis,
        functionName: "get_analysis",
        args: [],
      });

      return JSON.parse(raw as string) as WeatherDecision;
    });

    recordSuccess(contractName);
    return result;
  } catch (err) {
    recordFailure(contractName);
    throw classifyError(err, contractName);
  }
}

// ─── TravelComparisonContract ─────────────────────────────────────────────────
export async function invokeTravelComparison(params: {
  locations: Array<{ name: string; lat: string; lon: string }>;
  purpose: string;
  travel_date: string;
}): Promise<ComparisonResult> {
  const contractName = "travelComparison";
  checkCircuit(contractName);

  try {
    const result = await withRetry(async () => {
      const client = getClient();

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.travelComparison,
        functionName: "compare_locations",
        args: [
          JSON.stringify(params.locations),
          params.purpose,
          params.travel_date,
        ],
        value: BigInt(0),
      });

      await waitForFinality(client, txHash as `0x${string}`);

      const raw = await client.readContract({
        address: CONTRACT_ADDRESSES.travelComparison,
        functionName: "get_comparison",
        args: [],
      });

      return JSON.parse(raw as string) as ComparisonResult;
    });

    recordSuccess(contractName);
    return result;
  } catch (err) {
    recordFailure(contractName);
    throw classifyError(err, contractName);
  }
}

// ─── ActivityRiskContract ────────────────────────────────────────────────────
export async function invokeActivityRisk(params: {
  lat: string;
  lon: string;
  activity: string;
  location_name: string;
  target_date: string;
  duration_hours: string;
}): Promise<ActivityAssessment> {
  const contractName = "activityRisk";
  checkCircuit(contractName);

  try {
    const result = await withRetry(async () => {
      const client = getClient();

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.activityRisk,
        functionName: "assess_activity",
        args: [
          params.lat,
          params.lon,
          params.activity,
          params.location_name,
          params.target_date,
          params.duration_hours,
        ],
        value: BigInt(0),
      });

      await waitForFinality(client, txHash as `0x${string}`);

      const raw = await client.readContract({
        address: CONTRACT_ADDRESSES.activityRisk,
        functionName: "get_assessment",
        args: [],
      });

      return JSON.parse(raw as string) as ActivityAssessment;
    });

    recordSuccess(contractName);
    return result;
  } catch (err) {
    recordFailure(contractName);
    throw classifyError(err, contractName);
  }
}

// ─── WeatherAlertContract ────────────────────────────────────────────────────
export async function invokeWeatherAlert(params: {
  lat: string;
  lon: string;
  location_name: string;
  lookahead_hours: string;
}): Promise<AlertsResult> {
  const contractName = "weatherAlert";
  checkCircuit(contractName);

  try {
    const result = await withRetry(async () => {
      const client = getClient();

      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESSES.weatherAlert,
        functionName: "check_alerts",
        args: [
          params.lat,
          params.lon,
          params.location_name,
          params.lookahead_hours,
        ],
        value: BigInt(0),
      });

      await waitForFinality(client, txHash as `0x${string}`);

      const raw = await client.readContract({
        address: CONTRACT_ADDRESSES.weatherAlert,
        functionName: "get_alerts",
        args: [],
      });

      return JSON.parse(raw as string) as AlertsResult;
    });

    recordSuccess(contractName);
    return result;
  } catch (err) {
    recordFailure(contractName);
    throw classifyError(err, contractName);
  }
}

// ─── simulation functions ─────────────────────────────────────────────────────
// simulateWriteContract without rawReturn returns CalldataEncodable.
// The contract serializes its result as JSON, so we parse the returned value.

export async function simulateWeatherAnalysis(params: {
  lat: string;
  lon: string;
  query: string;
  location_name: string;
}): Promise<WeatherDecision> {
  const client = getClient();

  const raw = await client.simulateWriteContract({
    address: CONTRACT_ADDRESSES.weatherAnalysis,
    functionName: "analyze_weather",
    args: [params.lat, params.lon, params.query, params.location_name],
  });

  return JSON.parse(raw as string) as WeatherDecision;
}

export async function simulateTravelComparison(params: {
  locations: Array<{ name: string; lat: string; lon: string }>;
  purpose: string;
  travel_date: string;
}): Promise<ComparisonResult> {
  const client = getClient();

  const raw = await client.simulateWriteContract({
    address: CONTRACT_ADDRESSES.travelComparison,
    functionName: "compare_locations",
    args: [
      JSON.stringify(params.locations),
      params.purpose,
      params.travel_date,
    ],
  });

  return JSON.parse(raw as string) as ComparisonResult;
}

export async function simulateActivityRisk(params: {
  lat: string;
  lon: string;
  activity: string;
  location_name: string;
  target_date: string;
  duration_hours: string;
}): Promise<ActivityAssessment> {
  const client = getClient();

  const raw = await client.simulateWriteContract({
    address: CONTRACT_ADDRESSES.activityRisk,
    functionName: "assess_activity",
    args: [
      params.lat,
      params.lon,
      params.activity,
      params.location_name,
      params.target_date,
      params.duration_hours,
    ],
  });

  return JSON.parse(raw as string) as ActivityAssessment;
}

export async function simulateWeatherAlert(params: {
  lat: string;
  lon: string;
  location_name: string;
  lookahead_hours: string;
}): Promise<AlertsResult> {
  const client = getClient();

  const raw = await client.simulateWriteContract({
    address: CONTRACT_ADDRESSES.weatherAlert,
    functionName: "check_alerts",
    args: [
      params.lat,
      params.lon,
      params.location_name,
      params.lookahead_hours,
    ],
  });

  return JSON.parse(raw as string) as AlertsResult;
}

// ─── contract address getter (for UI display) ─────────────────────────────────
export function getContractAddresses() {
  return CONTRACT_ADDRESSES;
}
