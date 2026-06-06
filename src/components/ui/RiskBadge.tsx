import * as React from "react"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/types"

type RiskBadgeProps = {
  risk: RiskLevel
  className?: string
  /** Visual size — defaults to "md" */
  size?: "sm" | "md" | "lg"
}

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
  HIGH: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
}

const RISK_DOTS: Record<RiskLevel, string> = {
  LOW: "bg-emerald-500",
  MEDIUM: "bg-amber-500",
  HIGH: "bg-red-500",
}

const SIZE_STYLES: Record<NonNullable<RiskBadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
}

export function RiskBadge({ risk, className, size = "md" }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        RISK_STYLES[risk],
        SIZE_STYLES[size],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", RISK_DOTS[risk])} />
      {risk}
    </span>
  )
}
