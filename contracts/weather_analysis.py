# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
WeatherAnalysisContract — primary reasoning engine for Chromium AI Weather Intelligence.

Fetches live Open-Meteo data inside a nondet block, normalizes meteorological signals
into deterministic scores, applies LLM reasoning for human-facing analysis, and stores
a structured decision record.  Validators reproduce the fetch and check that their
independently-derived risk_level and overall decision match the leader's output
within defined equivalence bounds.
"""
from genlayer import *
import json


class WeatherAnalysisContract(gl.Contract):
    # ─── persistent state ───────────────────────────────────────────────────────
    last_result: str        # JSON-serialised WeatherDecision
    analysis_count: u64
    cache_lat: str
    cache_lon: str
    cache_timestamp: u64    # unix epoch seconds at last write

    def __init__(self) -> None:
        self.last_result = ""
        self.analysis_count = u64(0)
        self.cache_lat = ""
        self.cache_lon = ""
        self.cache_timestamp = u64(0)

    # ─── public read ────────────────────────────────────────────────────────────
    @gl.public.view
    def get_analysis(self) -> str:
        return self.last_result

    @gl.public.view
    def get_count(self) -> u64:
        return self.analysis_count

    # ─── public write ───────────────────────────────────────────────────────────
    @gl.public.write
    def analyze_weather(
        self,
        lat: str,
        lon: str,
        query: str,
        location_name: str,
    ) -> None:
        """
        Main entry-point.  All weather logic runs here inside GenLayer consensus.

        Args:
            lat: Latitude as string (e.g. "40.7128")
            lon: Longitude as string (e.g. "-74.0060")
            query: Natural-language query ("Is it safe to fly to NYC tomorrow?")
            location_name: Human-readable place name ("New York City, NY")
        """

        # ── leader: fetch live data and reason with LLM ──────────────────────
        def leader_fn():
            # Build Open-Meteo URL — 7-day forecast, hourly + daily variables
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&hourly=temperature_2m,apparent_temperature,precipitation,rain,"
                f"snowfall,snow_depth,weather_code,pressure_msl,surface_pressure,"
                f"visibility,wind_speed_10m,wind_gusts_10m,uv_index,"
                f"relative_humidity_2m,dew_point_2m,cloud_cover"
                f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                f"rain_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,"
                f"uv_index_max,weather_code,sunrise,sunset,precipitation_probability_max"
                f"&current=temperature_2m,apparent_temperature,weather_code,"
                f"wind_speed_10m,wind_gusts_10m,precipitation,rain,snowfall,"
                f"relative_humidity_2m,pressure_msl,visibility,uv_index"
                f"&forecast_days=7&wind_speed_unit=kmh&temperature_unit=celsius"
                f"&precipitation_unit=mm&timezone=auto"
            )

            raw = gl.nondet.web.get(url)
            weather = json.loads(raw)

            # Extract current conditions compactly for the prompt
            current = weather.get("current", {})
            daily = weather.get("daily", {})
            hourly = weather.get("hourly", {})

            current_summary = {
                "temp_c": current.get("temperature_2m"),
                "feels_like_c": current.get("apparent_temperature"),
                "weather_code": current.get("weather_code"),
                "wind_kmh": current.get("wind_speed_10m"),
                "gusts_kmh": current.get("wind_gusts_10m"),
                "precipitation_mm": current.get("precipitation"),
                "humidity_pct": current.get("relative_humidity_2m"),
                "pressure_hpa": current.get("pressure_msl"),
                "visibility_m": current.get("visibility"),
                "uv_index": current.get("uv_index"),
            }

            # Next 24 h hourly summary (first 24 indices)
            next_24h = {
                "max_wind_kmh": max(hourly.get("wind_speed_10m", [0])[:24] or [0]),
                "max_gusts_kmh": max(hourly.get("wind_gusts_10m", [0])[:24] or [0]),
                "total_precip_mm": sum(hourly.get("precipitation", [0])[:24] or [0]),
                "min_visibility_m": min(hourly.get("visibility", [10000])[:24] or [10000]),
                "max_uv": max(hourly.get("uv_index", [0])[:24] or [0]),
                "weather_codes": hourly.get("weather_code", [])[:24],
            }

            # 7-day daily summary
            week = {
                "temp_max": daily.get("temperature_2m_max", [])[:7],
                "temp_min": daily.get("temperature_2m_min", [])[:7],
                "precip_sum": daily.get("precipitation_sum", [])[:7],
                "wind_max": daily.get("wind_speed_10m_max", [])[:7],
                "gusts_max": daily.get("wind_gusts_10m_max", [])[:7],
                "uv_max": daily.get("uv_index_max", [])[:7],
                "weather_codes": daily.get("weather_code", [])[:7],
                "precip_prob_max": daily.get("precipitation_probability_max", [])[:7],
            }

            # ── WMO weather code classification ─────────────────────────────
            def classify_wmo(code):
                if code is None:
                    return "unknown"
                code = int(code)
                if code == 0:
                    return "clear"
                if code in (1, 2, 3):
                    return "partly_cloudy"
                if code in range(45, 50):
                    return "fog"
                if code in range(51, 68):
                    return "drizzle_rain"
                if code in range(71, 78):
                    return "snow"
                if code in range(80, 83):
                    return "showers"
                if code in range(85, 87):
                    return "snow_showers"
                if code in range(95, 100):
                    return "thunderstorm"
                return "other"

            condition = classify_wmo(current.get("weather_code"))

            # ── deterministic score computation (numeric, reproducible) ──────
            def compute_comfort_score(c):
                score = 100
                t = c.get("temp_c") or 20
                if t < 0:
                    score -= 40
                elif t < 5:
                    score -= 25
                elif t < 10:
                    score -= 10
                elif t > 38:
                    score -= 40
                elif t > 32:
                    score -= 20
                elif t > 28:
                    score -= 8
                w = c.get("wind_kmh") or 0
                if w > 80:
                    score -= 35
                elif w > 50:
                    score -= 20
                elif w > 30:
                    score -= 8
                p = c.get("precipitation_mm") or 0
                if p > 10:
                    score -= 30
                elif p > 5:
                    score -= 15
                elif p > 1:
                    score -= 5
                h = c.get("humidity_pct") or 50
                if h > 90:
                    score -= 10
                elif h < 20:
                    score -= 8
                v = c.get("visibility_m") or 10000
                if v < 500:
                    score -= 25
                elif v < 2000:
                    score -= 10
                return max(0, min(100, score))

            def compute_risk_level(c, n24, condition):
                # Extreme conditions → HIGH
                if (
                    "thunderstorm" in condition
                    or (c.get("wind_kmh") or 0) > 80
                    or (c.get("gusts_kmh") or 0) > 100
                    or (n24.get("total_precip_mm") or 0) > 50
                    or (c.get("visibility_m") or 10000) < 200
                ):
                    return "HIGH"
                # Moderate conditions → MEDIUM
                if (
                    "snow" in condition
                    or "fog" in condition
                    or (c.get("wind_kmh") or 0) > 40
                    or (n24.get("total_precip_mm") or 0) > 15
                    or (c.get("visibility_m") or 10000) < 1000
                    or (c.get("temp_c") is not None and (c["temp_c"] < 0 or c["temp_c"] > 38))
                ):
                    return "MEDIUM"
                return "LOW"

            comfort_score = compute_comfort_score(current_summary)
            risk_level = compute_risk_level(current_summary, next_24h, condition)

            # ── LLM reasoning pass ───────────────────────────────────────────
            prompt = f"""You are a meteorologist AI embedded in a GenLayer Intelligent Contract.
Analyze the following live weather data for {location_name} and respond to the user query.

USER QUERY: {query}

CURRENT CONDITIONS:
{json.dumps(current_summary, indent=2)}

NEXT 24H SUMMARY:
{json.dumps(next_24h, indent=2)}

7-DAY FORECAST SUMMARY:
{json.dumps(week, indent=2)}

PRE-COMPUTED SCORES (authoritative — do NOT override):
- comfort_score: {comfort_score}/100
- risk_level: {risk_level}
- condition_class: {condition}

Respond ONLY with a valid JSON object matching this schema exactly:
{{
  "decision": "GO | CAUTION | AVOID",
  "confidence": <integer 0-100>,
  "risk_level": "{risk_level}",
  "comfort_score": {comfort_score},
  "condition_class": "{condition}",
  "reasoning": "<2-3 sentence meteorological explanation>",
  "recommendation": "<one clear actionable sentence>",
  "alternative_days": [<list of day indices 0-6 with better conditions, empty if today is best>],
  "key_factors": [<list of 3-5 short factor strings>],
  "alerts": [<list of alert strings if any severe conditions>]
}}

Rules:
- decision must be GO (comfortable, low risk), CAUTION (moderate concern), or AVOID (dangerous/severe)
- risk_level MUST match the pre-computed value: {risk_level}
- comfort_score MUST match pre-computed value: {comfort_score}
- confidence reflects how clear-cut the conditions are (100 = absolutely certain)
- be concise and precise; no markdown, no prose outside JSON
"""

            result_str = gl.nondet.exec_prompt(prompt)
            result = json.loads(result_str)

            # Enforce pre-computed deterministic fields
            result["risk_level"] = risk_level
            result["comfort_score"] = comfort_score
            result["condition_class"] = condition
            result["location"] = location_name
            result["lat"] = lat
            result["lon"] = lon
            result["query"] = query

            return result

        # ── validator: re-fetch independently and verify structural consensus ─
        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False

            leader_data = leaders_res.calldata

            # Validators check risk_level and decision alignment
            try:
                my_result = leader_fn()
                # Risk level must match exactly (it's deterministically computed)
                if my_result["risk_level"] != leader_data.get("risk_level"):
                    return False
                # Comfort score within 15 points (weather data may differ by seconds)
                leader_score = int(leader_data.get("comfort_score", 0))
                my_score = int(my_result.get("comfort_score", 0))
                if abs(leader_score - my_score) > 15:
                    return False
                # Decision must agree (derived from risk_level so should match)
                if my_result.get("decision") != leader_data.get("decision"):
                    return False
                return True
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.last_result = json.dumps(result)
        self.analysis_count = u64(int(self.analysis_count) + 1)
        self.cache_lat = lat
        self.cache_lon = lon
