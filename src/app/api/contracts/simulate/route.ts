import { NextRequest, NextResponse } from "next/server";
import { createClient, createAccount, chains } from "genlayer-js";

const { testnetBradbury } = chains;

type ContractName =
  | "weatherAnalysis"
  | "travelComparison"
  | "activityRisk"
  | "weatherAlert";

type SimulateBody = {
  contract: ContractName;
  params: Record<string, string>;
};

type SimulateResponse =
  | { ok: true; result: unknown }
  | { ok: false; error: string; code?: string };

const CONTRACT_CONFIGS: Record<
  ContractName,
  {
    envKey: string;
    fallback: string;
    methodName: string;
    buildArgs: (params: Record<string, string>) => string[];
  }
> = {
  weatherAnalysis: {
    envKey: "GENLAYER_WEATHER_ANALYSIS_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000001",
    methodName: "analyze_weather",
    buildArgs: (p) => [p.lat ?? "", p.lon ?? "", p.query ?? "", p.location_name ?? ""],
  },
  travelComparison: {
    envKey: "GENLAYER_TRAVEL_COMPARISON_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000002",
    methodName: "compare_locations",
    buildArgs: (p) => [p.locations ?? "[]", p.purpose ?? "", p.travel_date ?? ""],
  },
  activityRisk: {
    envKey: "GENLAYER_ACTIVITY_RISK_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000003",
    methodName: "assess_activity",
    buildArgs: (p) => [
      p.lat ?? "",
      p.lon ?? "",
      p.activity ?? "",
      p.location_name ?? "",
      p.target_date ?? "",
      p.duration_hours ?? "",
    ],
  },
  weatherAlert: {
    envKey: "GENLAYER_WEATHER_ALERT_ADDRESS",
    fallback: "0x0000000000000000000000000000000000000004",
    methodName: "check_alerts",
    buildArgs: (p) => [p.lat ?? "", p.lon ?? "", p.location_name ?? "", p.lookahead_hours ?? "24"],
  },
};

const KNOWN_CONTRACTS = new Set<ContractName>([
  "weatherAnalysis",
  "travelComparison",
  "activityRisk",
  "weatherAlert",
]);

function isContractName(value: unknown): value is ContractName {
  return typeof value === "string" && KNOWN_CONTRACTS.has(value as ContractName);
}

function getSimulateClient() {
  const privateKey = process.env.GENLAYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) throw new Error("GENLAYER_PRIVATE_KEY is not set");
  const account = createAccount(privateKey);
  return createClient({ chain: testnetBradbury, account });
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SimulateResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("contract" in body) ||
    !("params" in body)
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: contract, params", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const { contract, params } = body as { contract: unknown; params: unknown };

  if (!isContractName(contract)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown contract: ${String(contract)}. Must be one of: ${Array.from(KNOWN_CONTRACTS).join(", ")}`,
        code: "UNKNOWN_CONTRACT",
      },
      { status: 400 },
    );
  }

  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return NextResponse.json(
      { ok: false, error: "params must be a plain object", code: "BAD_REQUEST" },
      { status: 400 },
    );
  }

  const config = CONTRACT_CONFIGS[contract];
  const contractAddress = (process.env[config.envKey] || config.fallback) as `0x${string}`;
  const argsArray = config.buildArgs(params as Record<string, string>);

  try {
    const client = getSimulateClient();

    const result = await client.simulateWriteContract({
      address: contractAddress,
      functionName: config.methodName,
      args: argsArray,
    });

    let parsed: unknown;
    try {
      parsed = typeof result === "string" ? JSON.parse(result) : result;
    } catch {
      parsed = result;
    }

    return NextResponse.json({ ok: true, result: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (
      message.includes("simulateWriteContract is not a function") ||
      message.includes("not implemented") ||
      message.includes("is not a function")
    ) {
      return NextResponse.json(
        { ok: false, error: "Simulation not available", code: "NOT_IMPLEMENTED" },
        { status: 501 },
      );
    }

    return NextResponse.json(
      { ok: false, error: message, code: "SIMULATION_ERROR" },
      { status: 500 },
    );
  }
}
