import Groq from "groq-sdk";
import type { AiExplanation, ExplanationType } from "@/types";

// ─── Shared Groq call ─────────────────────────────────────────────────────────

async function callGroq(system: string, user: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 300,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? null;
    if (!raw) return null;
    // Strip markdown code fences the model sometimes wraps around JSON
    return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  } catch {
    return null;
  }
}

// ─── Inline reasoning generators (used by scoring.ts) ────────────────────────

export async function generateWeatherReasoning(data: {
  location: string;
  query: string;
  temp: number;
  feels: number;
  humidity: number;
  wind: number;
  gusts: number;
  precip: number;
  uv: number;
  visibility: number;
  condition: string;
  decision: string;
  risk_level: string;
  comfort_score: number;
}): Promise<{ reasoning: string; recommendation: string } | null> {
  const system =
    `You are a precise weather analyst. Given real-time weather data for a specific location, ` +
    `write two things in JSON: ` +
    `"reasoning" (2-3 sentences describing the actual conditions and why they lead to the decision — ` +
    `mention how humidity, heat, wind, or other factors specifically affect this location) and ` +
    `"recommendation" (1 direct sentence telling the user what to do given their query). ` +
    `Be specific to the location and numbers. Never be generic. Respond with JSON only.`;

  const user =
    `Location: ${data.location}\n` +
    `User query: "${data.query}"\n` +
    `Conditions: ${data.condition}, ${data.temp}°C (feels like ${data.feels}°C)\n` +
    `Humidity: ${data.humidity}%, Wind: ${data.wind} km/h (gusts ${data.gusts} km/h)\n` +
    `Precipitation: ${data.precip} mm, UV index: ${data.uv}, Visibility: ${Math.round(data.visibility / 1000 * 10) / 10} km\n` +
    `Decision: ${data.decision}, Risk: ${data.risk_level}, Comfort score: ${data.comfort_score}/100`;

  const raw = await callGroq(system, user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.reasoning === "string" && typeof parsed.recommendation === "string") {
      return { reasoning: parsed.reasoning, recommendation: parsed.recommendation };
    }
  } catch { /* fall through */ }
  return null;
}

export async function generateActivityReasoning(data: {
  location: string;
  activity: string;
  temp: number;
  precip: number;
  wind: number;
  gusts: number;
  uv: number;
  humidity: number;
  suitability: string;
  risk_level: string;
  risk_score: number;
  concerns: string[];
  duration_hours: string;
}): Promise<{ recommendation: string } | null> {
  const system =
    `You are an activity safety advisor. Given real weather conditions and an activity, ` +
    `write a "recommendation" (1-2 direct sentences) telling the user whether and how to proceed ` +
    `with their activity. Reference the actual conditions. Be specific — mention temperature, ` +
    `wind, rain, or UV as relevant to THIS activity in THIS location. Respond with JSON only.`;

  const user =
    `Location: ${data.location}, Activity: ${data.activity} (${data.duration_hours}h session)\n` +
    `Temp: ${data.temp}°C, Humidity: ${data.humidity}%, Wind: ${data.wind} km/h (gusts ${data.gusts} km/h)\n` +
    `Precipitation: ${data.precip} mm, UV: ${data.uv}\n` +
    `Suitability: ${data.suitability}, Risk: ${data.risk_level} (score ${data.risk_score}/100)\n` +
    `Key concerns: ${data.concerns.join("; ") || "none"}`;

  const raw = await callGroq(system, user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.recommendation === "string") {
      return { recommendation: parsed.recommendation };
    }
  } catch { /* fall through */ }
  return null;
}

export async function generateComparisonReasoning(data: {
  purpose: string;
  travel_date: string;
  best: { name: string; score: number; condition: string; temp: number | null };
  runnerUp: { name: string; score: number; condition: string } | null;
  allLocations: Array<{ name: string; score: number; condition: string }>;
}): Promise<{ reasoning: string } | null> {
  const system =
    `You are a travel weather advisor. Given weather scores for multiple destinations, ` +
    `write a "reasoning" (2-3 sentences) explaining why the top-ranked location is best ` +
    `for the user's purpose, comparing it specifically against the others. ` +
    `Reference conditions and scores. Be direct and specific. Respond with JSON only.`;

  const others = data.allLocations
    .filter((l) => l.name !== data.best.name)
    .map((l) => `${l.name} (${l.score}/100, ${l.condition})`)
    .join(", ");

  const user =
    `Purpose: ${data.purpose} on ${data.travel_date}\n` +
    `Best: ${data.best.name} — score ${data.best.score}/100, ${data.best.condition}` +
    (data.best.temp != null ? `, ${Math.round(data.best.temp)}°C` : "") + `\n` +
    `Others: ${others || "none"}`;

  const raw = await callGroq(system, user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.reasoning === "string") {
      return { reasoning: parsed.reasoning };
    }
  } catch { /* fall through */ }
  return null;
}

export async function generateAlertSummary(data: {
  location: string;
  hours: number;
  overall_severity: string;
  alert_types: string[];
  peak_values: string[];
}): Promise<{ summary: string } | null> {
  const system =
    `You are a weather safety communicator. Given active weather alerts, ` +
    `write a "summary" (1-2 sentences) that conveys urgency and specific danger to someone in this location. ` +
    `Name the alert types and peak values. Be direct. Respond with JSON only.`;

  const user =
    `Location: ${data.location}, Lookahead: ${data.hours} hours\n` +
    `Overall severity: ${data.overall_severity}\n` +
    `Active alerts: ${data.alert_types.join(", ")}\n` +
    `Peak values: ${data.peak_values.join(", ")}`;

  const raw = await callGroq(system, user);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.summary === "string") {
      return { summary: parsed.summary };
    }
  } catch { /* fall through */ }
  return null;
}

type GenerateExplanationParams = {
  contractType: ExplanationType;
  contractResult: Record<string, unknown>;
  userQuery?: string;
};

const SYSTEM_PROMPTS: Record<ExplanationType, string> = {
  weather_decision: `You are a weather intelligence explainer. Your role is to EXPLAIN, not decide.

The GenLayer Intelligent Contract has already made a weather decision. You must accept it as-is and explain it in plain language.

Given the contract's result (JSON below) and optionally the user's original query, produce a JSON object with:
- "summary": a one-sentence summary of the contract's decision
- "explanation": a 2-4 sentence plain-language explanation of WHY the contract reached this decision, referencing specific factors from the result
- "key_insights": an array of 2-4 bullet-point insights the user would find most useful

Do NOT add information beyond what the contract provided. Do NOT change the decision. Do NOT introduce new weather analysis.`,

  activity: `You are an activity risk explainer. Your role is to EXPLAIN, not decide.

The GenLayer Intelligent Contract has already assessed the activity risk. You must accept the assessment as-is and explain it in plain language.

Given the contract's result (JSON below) and optionally the user's original query, produce a JSON object with:
- "summary": a one-sentence summary of the contract's suitability assessment
- "explanation": a 2-4 sentence plain-language explanation of WHY the contract assessed the risk this way, referencing key concerns and metrics
- "key_insights": an array of 2-4 bullet-point insights about the activity risk

Do NOT add information beyond what the contract provided. Do NOT change the suitability rating. Do NOT introduce new risk analysis.`,

  comparison: `You are a travel comparison explainer. Your role is to EXPLAIN, not decide.

The GenLayer Intelligent Contract has already determined the best travel location. You must accept the ranking as-is and explain it in plain language.

Given the contract's result (JSON below) and optionally the user's original query, produce a JSON object with:
- "summary": a one-sentence summary of which location the contract chose as best
- "explanation": a 2-4 sentence plain-language explanation of WHY the contract ranked the locations this way, referencing scores and reasoning
- "key_insights": an array of 2-4 bullet-point insights about the comparison

Do NOT add information beyond what the contract provided. Do NOT change the rankings. Do NOT introduce new comparison criteria.`,

  alerts: `You are a weather safety explainer. Your role is to EXPLAIN, not decide.

The GenLayer Intelligent Contract has already detected weather alerts. You must accept the alert assessment as-is and explain it in plain language.

Given the contract's result (JSON below) and optionally the user's original query, produce a JSON object with:
- "summary": a one-sentence summary of the overall alert situation
- "explanation": a 2-4 sentence plain-language explanation of the alerts, their severity, and what they mean for the user
- "key_insights": an array of 2-4 bullet-point insights about the most critical alerts or their implications

Do NOT add information beyond what the contract provided. Do NOT change the severity. Do NOT introduce new alert concerns.`,

  activity_compare: `You are an activity comparison explainer. Your role is to EXPLAIN, not decide.

The GenLayer Intelligent Contract has already ranked locations for a specific activity. You must accept the rankings as-is and explain them in plain language.

Given the contract's result (JSON below) and optionally the user's original query, produce a JSON object with:
- "summary": a one-sentence summary of which location the contract ranked best for the activity
- "explanation": a 2-4 sentence plain-language explanation of WHY the contract ranked the locations this way, referencing suitability and risk scores
- "key_insights": an array of 2-4 bullet-point insights about the activity comparison across locations

Do NOT add information beyond what the contract provided. Do NOT change the rankings. Do NOT introduce new comparison criteria.`,
};

function buildUserPrompt(params: GenerateExplanationParams): string {
  const lines: string[] = [];
  lines.push("Contract type: " + params.contractType);
  if (params.userQuery) {
    lines.push("User query: " + params.userQuery);
  }
  lines.push("");
  lines.push("Contract result (JSON):");
  lines.push(JSON.stringify(params.contractResult, null, 2));
  return lines.join("\n");
}

export async function generateExplanation(
  params: GenerateExplanationParams,
): Promise<AiExplanation> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const groq = new Groq({ apiKey });

  const systemPrompt = SYSTEM_PROMPTS[params.contractType];
  const userPrompt = buildUserPrompt(params);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: userPrompt + "\n\nRespond with valid JSON only.",
      },
    ],
    temperature: 0.3,
    max_tokens: 500,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("AI_ERROR");
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.explanation !== "string" ||
    !Array.isArray(parsed.key_insights)
  ) {
    throw new Error("AI_ERROR");
  }

  return {
    summary: parsed.summary,
    explanation: parsed.explanation,
    key_insights: parsed.key_insights as string[],
  };
}
