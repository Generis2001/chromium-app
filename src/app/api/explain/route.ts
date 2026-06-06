import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { generateExplanation } from "@/lib/ai/explainer";
import { getCachedExplanation, cacheExplanation } from "@/lib/db";
import type { AiExplanation, ApiResponse } from "@/types";

const VALID_TYPES = [
  "weather_decision",
  "activity",
  "comparison",
  "alerts",
  "activity_compare",
] as const;

const BodySchema = z.object({
  contract_type: z.enum(VALID_TYPES),
  contract_result: z.record(z.string(), z.unknown()),
  user_query: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<AiExplanation>>> {
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 },
      );
    }

    const { contract_type, contract_result, user_query } = parsed.data;

    const inputHash = createHash("sha256")
      .update(
        contract_type +
          JSON.stringify(contract_result) +
          (user_query ?? ""),
      )
      .digest("hex");

    try {
      const cached = await getCachedExplanation(contract_type, inputHash);
      if (cached) {
        return NextResponse.json({ ok: true, data: cached, cached: true });
      }
    } catch {
      // DB unavailable — fall through to OpenAI
    }

    const explanation = await generateExplanation({
      contractType: contract_type,
      contractResult: contract_result,
      userQuery: user_query,
    });

    try {
      await cacheExplanation(contract_type, inputHash, explanation);
    } catch {
      // Non-fatal cache failure
    }

    return NextResponse.json({ ok: true, data: explanation, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "AI explanation failed";
    const code =
      message === "AI_NOT_CONFIGURED" ? "AI_NOT_CONFIGURED" : "AI_ERROR";
    console.error("[explain]", err);
    return NextResponse.json(
      { ok: false, error: message, code },
      { status: 500 },
    );
  }
}
