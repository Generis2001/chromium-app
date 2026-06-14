import { NextResponse } from "next/server";
import { createClient, createAccount, chains } from "genlayer-js";

const { studionet } = chains;

type ContractStatus = "healthy" | "degraded" | "unreachable";
type OverallStatus = "healthy" | "degraded" | "unhealthy";

type ContractHealth = {
  name: string;
  address: string;
  status: ContractStatus;
  latencyMs: number;
  lastChecked: string;
  error?: string;
};

type HealthResponse = {
  ok: boolean;
  timestamp: string;
  contracts: ContractHealth[];
  overall: OverallStatus;
  network: string;
};

const PLACEHOLDER_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000004",
]);

const CONTRACT_CONFIGS = [
  {
    name: "weatherAnalysis",
    envKey: "GENLAYER_WEATHER_ANALYSIS_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000001",
    viewFn: "get_analysis",
  },
  {
    name: "travelComparison",
    envKey: "GENLAYER_TRAVEL_COMPARISON_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000002",
    viewFn: "get_comparison",
  },
  {
    name: "activityRisk",
    envKey: "GENLAYER_ACTIVITY_RISK_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000003",
    viewFn: "get_assessment",
  },
  {
    name: "weatherAlert",
    envKey: "GENLAYER_WEATHER_ALERT_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000004",
    viewFn: "get_alerts",
  },
] as const;

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
  );
}

function getReadClient() {
  const privateKey = (process.env.GENLAYER_PRIVATE_KEY ||
    "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`;
  const account = createAccount(privateKey);
  return createClient({ chain: studionet, account });
}

async function checkContract(config: {
  name: string;
  envKey: string;
  fallback: string;
  viewFn: string;
}): Promise<ContractHealth> {
  const address = (process.env[config.envKey] || config.fallback) as `0x${string}`;
  const lastChecked = new Date().toISOString();

  if (PLACEHOLDER_ADDRESSES.has(address)) {
    return {
      name: config.name,
      address,
      status: "degraded",
      latencyMs: 0,
      lastChecked,
      error: "Not yet deployed",
    };
  }

  const start = Date.now();

  try {
    const check = async () => {
      const client = getReadClient();
      await client.readContract({
        address,
        functionName: config.viewFn,
        args: [],
      });
    };

    await Promise.race([check(), timeoutPromise(10000)]);

    return {
      name: config.name,
      address,
      status: "healthy",
      latencyMs: Date.now() - start,
      lastChecked,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    const timedOut = error.includes("Timed out");

    return {
      name: config.name,
      address,
      status: timedOut ? "unreachable" : "degraded",
      latencyMs,
      lastChecked,
      error,
    };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const timestamp = new Date().toISOString();

  const settled = await Promise.allSettled(
    CONTRACT_CONFIGS.map((cfg) => checkContract(cfg)),
  );

  const contracts: ContractHealth[] = settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return {
      name: CONTRACT_CONFIGS[i].name,
      address: process.env[CONTRACT_CONFIGS[i].envKey] || CONTRACT_CONFIGS[i].fallback,
      status: "unreachable" as ContractStatus,
      latencyMs: 0,
      lastChecked: timestamp,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    };
  });

  const unreachableCount = contracts.filter(
    (c) => c.status === "unreachable",
  ).length;

  const overall: OverallStatus =
    unreachableCount === 0
      ? "healthy"
      : unreachableCount >= 3
        ? "unhealthy"
        : "degraded";

  return NextResponse.json({
    ok: overall !== "unhealthy",
    timestamp,
    contracts,
    overall,
    network: "studionet",
  });
}
