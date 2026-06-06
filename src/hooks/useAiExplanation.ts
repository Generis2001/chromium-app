"use client";

import { useState, useCallback } from "react";
import type { AiExplanation, ExplainRequest, ApiResponse } from "@/types";

export function useAiExplanation(): {
  explanation: AiExplanation | null;
  isLoading: boolean;
  error: string | null;
  fetchExplanation: (params: ExplainRequest) => Promise<AiExplanation | null>;
  clearExplanation: () => void;
} {
  const [explanation, setExplanation] = useState<AiExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(
    async (params: ExplainRequest): Promise<AiExplanation | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const json = (await res.json()) as ApiResponse<AiExplanation>;
        if (json.ok) {
          setExplanation(json.data);
          return json.data;
        } else {
          setError(json.error);
          return null;
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load explanation",
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearExplanation = useCallback(() => {
    setExplanation(null);
    setError(null);
  }, []);

  return { explanation, isLoading, error, fetchExplanation, clearExplanation };
}
