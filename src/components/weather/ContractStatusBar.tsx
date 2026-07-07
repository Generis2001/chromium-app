"use client";

import { useState, useEffect, useCallback } from "react";

type ContractStatus = "healthy" | "degraded" | "unreachable";

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
  overall: "healthy" | "degraded" | "unhealthy";
  network: string;
};

const STATUS_COLOR: Record<ContractStatus, string> = {
  healthy: "#22c55e",
  degraded: "#f59e0b",
  unreachable: "#ef4444",
};

function StatusPill({
  contract,
  loading,
}: {
  contract: ContractHealth | null;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  if (loading || contract === null) {
    return (
      <span
        className="animate-pulse rounded-full inline-block"
        style={{ width: 8, height: 2, background: "#6b7280" }}
      />
    );
  }

  const color = STATUS_COLOR[contract.status];
  const label = `${contract.name} · ${contract.latencyMs}ms${contract.error ? ` · ${contract.error}` : ""}`;

  return (
    <span
      className="relative inline-block cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className="rounded-full inline-block"
        style={{ width: 8, height: 2, background: color }}
      />
      {hovered && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 whitespace-nowrap rounded px-2 py-1 text-[10px] leading-tight pointer-events-none"
          style={{
            background: "rgba(15,15,15,0.9)",
            color: "#e5e7eb",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

export function ContractStatusBar() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts/health");
      if (!res.ok) throw new Error("fetch failed");
      const json = (await res.json()) as HealthResponse;
      setData(json);
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialId = setTimeout(() => void fetchHealth(), 0);
    const id = setInterval(() => void fetchHealth(), 30_000);
    return () => {
      clearTimeout(initialId);
      clearInterval(id);
    };
  }, [fetchHealth]);

  const contracts = data?.contracts ?? null;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      {loading && contracts === null ? (
        <>
          {Array.from({ length: 4 }).map((_, i) => (
            <StatusPill key={i} contract={null} loading={true} />
          ))}
        </>
      ) : (
        <>
          {(contracts ?? Array.from({ length: 4 }).map(() => null)).map(
            (c, i) => (
              <StatusPill key={i} contract={c} loading={false} />
            ),
          )}
        </>
      )}
    </div>
  );
}
