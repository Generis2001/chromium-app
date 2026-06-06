import * as React from "react"
import { cn } from "@/lib/utils"
import type { Decision } from "@/types"

type DecisionBadgeProps = {
  decision: Decision
  className?: string
  size?: "sm" | "md" | "lg"
}

const DECISION_STYLES: Record<Decision, string> = {
  GO: "bg-emerald-500 text-white border-emerald-600",
  CAUTION: "bg-amber-500 text-white border-amber-600",
  AVOID: "bg-red-500 text-white border-red-600",
}

const SIZE_STYLES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
}

export function DecisionBadge({ decision, className, size = "md" }: DecisionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-bold tracking-wide",
        DECISION_STYLES[decision],
        SIZE_STYLES[size],
        className
      )}
    >
      {decision}
    </span>
  )
}
