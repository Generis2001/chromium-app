"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useAiExplanation } from "@/hooks/useAiExplanation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  ExplanationType,
  WeatherDecision,
  ComparisonResult,
  ActivityAssessment,
  AlertsResult,
  ActivityComparisonResult,
} from "@/types";

type AiExplanationPanelProps = {
  contractType: ExplanationType;
  contractResult:
    | WeatherDecision
    | ComparisonResult
    | ActivityAssessment
    | AlertsResult
    | ActivityComparisonResult;
  userQuery?: string;
  className?: string;
};

const LABELS: Record<ExplanationType, string> = {
  weather_decision: "AI Weather Summary",
  activity: "AI Activity Summary",
  comparison: "AI Comparison Summary",
  alerts: "AI Alert Summary",
  activity_compare: "AI Activity Comparison",
};

export function AiExplanationPanel({
  contractType,
  contractResult,
  userQuery,
  className,
}: AiExplanationPanelProps) {
  const { explanation, isLoading, error, fetchExplanation } =
    useAiExplanation();
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = async () => {
    if (!isOpen && !explanation) {
      await fetchExplanation({
        contract_type: contractType,
        contract_result: contractResult as Record<string, unknown>,
        user_query: userQuery,
      });
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={cn("border-t border-slate-100 pt-3 mt-4", className)}>
      <button
        onClick={() => void handleToggle()}
        disabled={isLoading}
        className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
        type="button"
      >
        {isLoading && !explanation ? (
          <>
            <Loader2 size={12} className="animate-spin" />
            <span>Loading explanation...</span>
          </>
        ) : (
          <>
            <Sparkles size={12} className="text-amber-400" />
            <span>{isOpen ? "Hide AI Summary" : LABELS[contractType]}</span>
            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {isLoading && !explanation && <ExplanationSkeleton />}
            {!isLoading && error && <ExplanationError />}
            {!isLoading && explanation && (
              <ExplanationContent explanation={explanation} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExplanationSkeleton() {
  return (
    <div className="mt-3 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

function ExplanationError() {
  return (
    <div className="mt-3 text-xs text-slate-400 italic">
      AI summary is temporarily unavailable.
    </div>
  );
}

function ExplanationContent({
  explanation,
}: {
  explanation: { summary: string; explanation: string; key_insights: string[] };
}) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-medium text-slate-700 leading-relaxed">
        {explanation.summary}
      </p>

      <p className="text-xs text-slate-500 leading-relaxed">
        {explanation.explanation}
      </p>

      {explanation.key_insights.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Key Insights
          </p>
          <ul className="space-y-1">
            {explanation.key_insights.map((insight, i) => (
              <li
                key={i}
                className="text-xs text-slate-600 flex items-start gap-1.5"
              >
                <span className="text-amber-400 mt-0.5">◆</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
