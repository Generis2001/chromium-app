/**
 * Chromium — shared TypeScript types for the entire application.
 * All decision types originate from GenLayer contract results.
 */

// ─── GenLayer contract addresses ────────────────────────────────────────────
export type ContractAddresses = {
  weatherAnalysis: `0x${string}`;
  travelComparison: `0x${string}`;
  activityRisk: `0x${string}`;
  weatherAlert: `0x${string}`;
};

// ─── Weather analysis (WeatherAnalysisContract) ──────────────────────────────
export type Decision = "GO" | "CAUTION" | "AVOID";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Severity = "NONE" | "WATCH" | "WARNING" | "EMERGENCY";
export type Suitability = "SUITABLE" | "MARGINAL" | "UNSUITABLE";

export type WeatherDecision = {
  decision: Decision;
  confidence: number; // 0-100
  risk_level: RiskLevel;
  comfort_score: number; // 0-100
  condition_class: string;
  reasoning: string;
  recommendation: string;
  alternative_days: number[]; // indices 0-6
  key_factors: string[];
  alerts: string[];
  location: string;
  lat: string;
  lon: string;
  query: string;
  temp_c: number;
};

// ─── Travel comparison (TravelComparisonContract) ────────────────────────────
export type CityScore = {
  name: string;
  lat: string;
  lon: string;
  overall_score: number;
  comfort_score: number;
  precipitation_score: number;
  wind_score: number;
  visibility_score: number;
  condition: string;
  temp_current: number | null;
};

export type RankedLocation = {
  rank: number;
  name: string;
  overall_score: number;
  reason: string;
  condition: string;
};

export type ComparisonResult = {
  best_location: string;
  reasoning: string;
  ranked_locations: RankedLocation[];
  purpose_note: string;
  scores: CityScore[];
  purpose: string;
  travel_date: string;
};

// ─── Activity risk (ActivityRiskContract) ────────────────────────────────────
export type ActivityMetrics = {
  temp_c: number;
  precip_mm: number;
  wind_kmh: number;
  gusts_kmh: number;
  visibility_m: number;
  humidity_pct: number;
  uv_index: number;
};

export type ActivityAssessment = {
  activity: string;
  suitability: Suitability;
  risk_level: RiskLevel;
  risk_score: number; // 0-100
  recommendation: string;
  key_concerns: string[];
  safety_tips: string[];
  best_time_window: string;
  gear_suggestions: string[];
  location: string;
  target_date: string;
  duration_hours: string;
  metrics: ActivityMetrics;
};

// ─── Weather alerts (WeatherAlertContract) ───────────────────────────────────
export type AlertType =
  | "thunderstorm"
  | "heavy_precipitation"
  | "extreme_heat"
  | "extreme_cold"
  | "high_wind"
  | "dense_fog"
  | "heavy_snow"
  | "extreme_uv"
  | "rapid_pressure_drop";

export type WeatherAlert = {
  id: string;
  type: AlertType;
  severity: "WATCH" | "WARNING" | "EMERGENCY";
  title: string;
  description: string;
  peak_value: number;
  affected_hours: number[];
  safety_actions: string[];
  expires_hours: number;
};

export type AlertsResult = {
  location: string;
  lat: string;
  lon: string;
  alert_count: number;
  alerts: WeatherAlert[];
  overall_severity: Severity;
  summary: string;
};

// ─── Activity comparison (Phase 6) ──────────────────────────────────────────────
export type ActivityCityScore = {
  name: string;
  rank: number;
  overall_score: number;
  suitability: Suitability;
  risk_level: RiskLevel;
  risk_score: number;
  key_concerns: string[];
  recommendation: string;
  best_time_window: string;
};

export type ActivityComparisonResult = {
  best_location: string;
  reasoning: string;
  ranked_locations: ActivityCityScore[];
  purpose_note: string;
  activity: string;
  target_date: string;
  partial_failures: string[];
};

// ─── Best-date finder (Phase 6) ─────────────────────────────────────────────────
export type DateRanking = {
  date: string;
  day_name: string;
  rank: number;
  overall_score: number;
  suitability: Suitability;
  risk_level: RiskLevel;
  risk_score: number;
  condition_summary: string;
};

export type BestDateResult = {
  best_date: string;
  best_day_name: string;
  reasoning: string;
  ranked_dates: DateRanking[];
  activity: string;
};

// ─── Geocoding ────────────────────────────────────────────────────────────────
export type GeocodingResult = {
  name: string;
  display_name: string;
  lat: string;
  lon: string;
  country: string;
  country_code: string;
  state?: string;
};

// ─── API request/response wrappers ────────────────────────────────────────────
export type AnalyzeWeatherRequest = {
  lat: string;
  lon: string;
  query: string;
  location_name: string;
};

export type CompareLocationsRequest = {
  locations: Array<{ name: string; lat: string; lon: string }>;
  purpose: string;
  travel_date: string;
};

export type AssessActivityRequest = {
  lat: string;
  lon: string;
  activity: string;
  location_name: string;
  target_date: string;
  duration_hours: string;
};

export type CheckAlertsRequest = {
  lat: string;
  lon: string;
  location_name: string;
  lookahead_hours: string;
};

export type ActivityCompareRequest = {
  locations: Array<{ name: string; lat: string; lon: string }>;
  activity: string;
  target_date: string;
};

export type BestDateRequest = {
  lat: string;
  lon: string;
  activity: string;
  location_name: string;
  duration_hours: string;
};

export type ApiResponse<T> =
  | { ok: true; data: T; cached?: boolean }
  | { ok: false; error: string; code?: string };

// ─── UI state types ───────────────────────────────────────────────────────────
export type DynamicIslandState =
  | "idle"
  | "loading"
  | "weather"
  | "alert"
  | "activity"
  | "comparison"
  | "expanded";

export type DynamicIslandData = {
  location: string;
  temp: number;
  condition: string;
  risk_level: RiskLevel;
  decision?: Decision;
  confidence?: number;
  reasoning?: string;
  alerts?: WeatherAlert[];
  // Phase 6: activity state
  activity_name?: string;
  suitability?: Suitability;
  // Phase 6: comparison state
  best_location?: string;
  comparison_count?: number;
};

// ─── AI Explanation Layer (Phase 5) ───────────────────────────────────────────
export type ExplanationType =
  | "weather_decision"
  | "activity"
  | "comparison"
  | "alerts"
  | "activity_compare";

export type AiExplanation = {
  summary: string;
  explanation: string;
  key_insights: string[];
};

export type ExplainRequest = {
  contract_type: ExplanationType;
  contract_result: Record<string, unknown>;
  user_query?: string;
};

// ─── Activity options ────────────────────────────────────────────────────────
export const SUPPORTED_ACTIVITIES = [
  "farming",
  "outdoor_sports",
  "construction",
  "camping",
  "photography",
  "travel",
  "marathon_running",
  "cycling",
  "beach",
  "skiing",
] as const;

export type SupportedActivity = (typeof SUPPORTED_ACTIVITIES)[number];

export const TRAVEL_PURPOSES = [
  "travel",
  "business",
  "outdoor_sports",
  "photography",
  "hiking",
  "beach",
] as const;

export type TravelPurpose = (typeof TRAVEL_PURPOSES)[number];
