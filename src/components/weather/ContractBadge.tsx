"use client";

import { useState } from "react";
import { Link } from "lucide-react";

type ContractKey =
  | "WeatherAnalysis"
  | "TravelComparison"
  | "ActivityRisk"
  | "WeatherAlert";

type ContractBadgeProps = {
  contract: ContractKey;
  address?: string;
  className?: string;
  variant?: "default" | "glass";
};

const SHORT_NAMES: Record<ContractKey, string> = {
  WeatherAnalysis: "Analysis",
  TravelComparison: "Comparison",
  ActivityRisk: "Activity",
  WeatherAlert: "Alert",
};

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ContractBadge({
  contract,
  address,
  className = "",
  variant = "default",
}: ContractBadgeProps) {
  const [hovered, setHovered] = useState(false);

  const baseClass =
    variant === "glass"
      ? "bg-white/10 backdrop-blur-sm text-white border border-white/20"
      : "bg-blue-50 text-blue-700 border border-blue-200";

  const tooltipText = address
    ? `${contract} · ${truncateAddress(address)}`
    : contract;

  return (
    <span
      className={`relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${baseClass} ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link size={8} strokeWidth={2.5} className="shrink-0" />
      <span>{SHORT_NAMES[contract]}</span>
      {hovered && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 whitespace-nowrap rounded px-2 py-1 text-[10px] leading-tight pointer-events-none"
          style={{
            background: "rgba(15,15,15,0.9)",
            color: "#e5e7eb",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}
