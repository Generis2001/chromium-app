export const CONTRACT_REGISTRY = {
  weatherAnalysis: {
    address: () =>
      (process.env.GENLAYER_WEATHER_ANALYSIS_ADDRESS ||
        "0x0000000000000000000000000000000000000001") as `0x${string}`,
    methods: {
      analyze_weather: {
        type: "write" as const,
        args: ["lat", "lon", "query", "location_name"] as const,
      },
      get_analysis: {
        type: "read" as const,
        args: [] as const,
        returns: "string" as const,
      },
      get_count: {
        type: "read" as const,
        args: [] as const,
        returns: "u64" as const,
      },
    },
  },
  travelComparison: {
    address: () =>
      (process.env.GENLAYER_TRAVEL_COMPARISON_ADDRESS ||
        "0x0000000000000000000000000000000000000002") as `0x${string}`,
    methods: {
      compare_locations: {
        type: "write" as const,
        args: ["locations", "purpose", "travel_date"] as const,
      },
      get_comparison: {
        type: "read" as const,
        args: [] as const,
        returns: "string" as const,
      },
      get_count: {
        type: "read" as const,
        args: [] as const,
        returns: "u64" as const,
      },
    },
  },
  activityRisk: {
    address: () =>
      (process.env.GENLAYER_ACTIVITY_RISK_ADDRESS ||
        "0x0000000000000000000000000000000000000003") as `0x${string}`,
    methods: {
      assess_activity: {
        type: "write" as const,
        args: [
          "lat",
          "lon",
          "activity",
          "location_name",
          "target_date",
          "duration_hours",
        ] as const,
      },
      get_assessment: {
        type: "read" as const,
        args: [] as const,
        returns: "string" as const,
      },
      get_count: {
        type: "read" as const,
        args: [] as const,
        returns: "u64" as const,
      },
    },
  },
  weatherAlert: {
    address: () =>
      (process.env.GENLAYER_WEATHER_ALERT_ADDRESS ||
        "0x0000000000000000000000000000000000000004") as `0x${string}`,
    methods: {
      check_alerts: {
        type: "write" as const,
        args: ["lat", "lon", "location_name", "lookahead_hours"] as const,
      },
      get_alerts: {
        type: "read" as const,
        args: [] as const,
        returns: "string" as const,
      },
      get_count: {
        type: "read" as const,
        args: [] as const,
        returns: "u64" as const,
      },
    },
  },
} as const;

export type ContractName = keyof typeof CONTRACT_REGISTRY;
export type ContractMethod<T extends ContractName> =
  keyof (typeof CONTRACT_REGISTRY)[T]["methods"];

export function getContractAddress(name: ContractName): `0x${string}` {
  return CONTRACT_REGISTRY[name].address();
}

export function isWriteMethod(name: ContractName, method: string): boolean {
  const methods = CONTRACT_REGISTRY[name].methods as Record<
    string,
    { type: "read" | "write" }
  >;
  return methods[method]?.type === "write";
}
