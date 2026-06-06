import * as React from "react"
import { cn } from "@/lib/utils"

type ScoreRingProps = {
  score: number // 0-100
  size?: number
  strokeWidth?: number
  className?: string
  label?: string
}

function getColor(score: number): string {
  if (score >= 75) return "#22c55e"  // green
  if (score >= 50) return "#f59e0b"  // amber
  if (score >= 25) return "#f97316"  // orange
  return "#ef4444"                   // red
}

export function ScoreRing({
  score,
  size = 64,
  strokeWidth = 6,
  className,
  label,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.max(0, Math.min(100, score))
  const offset = circumference - (clampedScore / 100) * circumference
  const color = getColor(clampedScore)

  return (
    <div
      className={cn("relative inline-flex flex-col items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-slate-700" style={{ fontSize: size * 0.22 }}>
          {clampedScore}
        </span>
        {label && (
          <span className="text-slate-400 leading-none" style={{ fontSize: size * 0.14 }}>
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
