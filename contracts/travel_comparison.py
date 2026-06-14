# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
TravelComparisonContract — compares multiple cities for a specific travel purpose
and determines the optimal destination based on live weather data.

Each city is fetched inside a single nondet block so validators can reproduce
all network calls.  The scoring is deterministic; only reasoning uses the LLM.
"""
from genlayer import *
import json
import re


def _extract_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text.strip())
    text = text.strip()
    start = text.find('{')
    end = text.rfind('}') + 1
    if start >= 0 and end > start:
        return text[start:end]
    return text


class TravelComparisonContract(gl.Contract):
    # ─── persistent state ───────────────────────────────────────────────────────
    last_comparison: str    # JSON serialised ComparisonResult
    comparison_count: u64

    def __init__(self) -> None:
        self.last_comparison = ""
        self.comparison_count = u64(0)

    # ─── public read ────────────────────────────────────────────────────────────
    @gl.public.view
    def get_comparison(self) -> str:
        return self.last_comparison

    # ─── public write ───────────────────────────────────────────────────────────
    @gl.public.write
    def compare_locations(
        self,
        locations_json: str,   # JSON list: [{"name": str, "lat": str, "lon": str}]
        purpose: str,          # "travel" | "business" | "outdoor_sports" | "photography" | "hiking" | "beach"
        travel_date: str,      # "today" | "tomorrow" | "weekend" | ISO date "YYYY-MM-DD"
    ) -> None:
        """
        Compares up to 5 cities and ranks them for the given purpose and travel date.
        All weather fetching and scoring happens inside GenLayer consensus.
        """

        REQUIRED_FEE = 1_000_000_000_000_000_000  # 1 GEN in wei
        if int(gl.message.value) < REQUIRED_FEE:
            raise Exception(
                f"Insufficient fee: send at least 1 GEN ({REQUIRED_FEE} wei). "
                f"Received {int(gl.message.value)} wei."
            )

        def leader_fn():
            locations = json.loads(locations_json)
            if len(locations) > 5:
                locations = locations[:5]

            purpose_weights = {
                "travel": {"comfort": 0.35, "precipitation": 0.30, "wind": 0.20, "visibility": 0.15},
                "business": {"comfort": 0.40, "precipitation": 0.25, "wind": 0.15, "visibility": 0.20},
                "outdoor_sports": {"comfort": 0.25, "precipitation": 0.30, "wind": 0.25, "visibility": 0.20},
                "photography": {"comfort": 0.20, "precipitation": 0.20, "wind": 0.15, "visibility": 0.45},
                "hiking": {"comfort": 0.30, "precipitation": 0.30, "wind": 0.25, "visibility": 0.15},
                "beach": {"comfort": 0.40, "precipitation": 0.25, "wind": 0.20, "visibility": 0.15},
            }
            weights = purpose_weights.get(purpose, purpose_weights["travel"])

            city_data = []
            for loc in locations:
                url = (
                    f"https://api.open-meteo.com/v1/forecast"
                    f"?latitude={loc['lat']}&longitude={loc['lon']}"
                    f"&current=temperature_2m,apparent_temperature,weather_code,"
                    f"wind_speed_10m,wind_gusts_10m,precipitation,rain,snowfall,"
                    f"relative_humidity_2m,visibility,uv_index"
                    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                    f"wind_speed_10m_max,wind_gusts_10m_max,weather_code,"
                    f"precipitation_probability_max,uv_index_max"
                    f"&forecast_days=7&wind_speed_unit=kmh&temperature_unit=celsius"
                    f"&precipitation_unit=mm&timezone=auto"
                )
                raw = gl.nondet.web.get(url).body
                data = json.loads(raw)

                current = data.get("current", {})
                daily = data.get("daily", {})

                # Determine target day index from travel_date
                # 0 = today, 1 = tomorrow, 5/6 = weekend approximation
                day_idx = 0
                if travel_date == "tomorrow":
                    day_idx = 1
                elif travel_date in ("weekend", "saturday"):
                    day_idx = 5
                elif travel_date == "sunday":
                    day_idx = 6

                def safe_list_get(lst, idx, default=None):
                    if lst and len(lst) > idx:
                        return lst[idx]
                    return default

                # ── deterministic score per dimension (0-100) ────────────────
                def precip_score(precip_mm):
                    if precip_mm is None:
                        return 80
                    if precip_mm == 0:
                        return 100
                    if precip_mm < 1:
                        return 90
                    if precip_mm < 5:
                        return 70
                    if precip_mm < 15:
                        return 45
                    if precip_mm < 30:
                        return 20
                    return 5

                def wind_score(wind_kmh, gusts_kmh):
                    w = wind_kmh or 0
                    g = gusts_kmh or 0
                    top = max(w, g)
                    if top < 10:
                        return 100
                    if top < 20:
                        return 90
                    if top < 35:
                        return 70
                    if top < 50:
                        return 50
                    if top < 70:
                        return 25
                    return 5

                def comfort_score(temp_max, temp_min, humidity=None):
                    if temp_max is None or temp_min is None:
                        return 70
                    avg = (temp_max + temp_min) / 2
                    score = 100
                    if avg < 0:
                        score -= 40
                    elif avg < 8:
                        score -= 20
                    elif avg < 15:
                        score -= 5
                    elif avg > 38:
                        score -= 40
                    elif avg > 32:
                        score -= 20
                    elif avg > 28:
                        score -= 8
                    return max(0, min(100, score))

                def visibility_score(vis_m):
                    if vis_m is None:
                        return 80
                    if vis_m >= 10000:
                        return 100
                    if vis_m >= 5000:
                        return 85
                    if vis_m >= 2000:
                        return 60
                    if vis_m >= 500:
                        return 30
                    return 5

                def wmo_to_condition(code):
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
                    if code in range(95, 100):
                        return "thunderstorm"
                    return "other"

                # Use current data for "today", daily data for future days
                if day_idx == 0:
                    ps = precip_score(current.get("precipitation"))
                    ws = wind_score(current.get("wind_speed_10m"), current.get("wind_gusts_10m"))
                    cs = comfort_score(
                        current.get("temperature_2m"),
                        current.get("apparent_temperature"),
                    )
                    vs = visibility_score(current.get("visibility"))
                    condition = wmo_to_condition(current.get("weather_code"))
                else:
                    ps = precip_score(safe_list_get(daily.get("precipitation_sum"), day_idx))
                    ws = wind_score(
                        safe_list_get(daily.get("wind_speed_10m_max"), day_idx),
                        safe_list_get(daily.get("wind_gusts_10m_max"), day_idx),
                    )
                    cs = comfort_score(
                        safe_list_get(daily.get("temperature_2m_max"), day_idx),
                        safe_list_get(daily.get("temperature_2m_min"), day_idx),
                    )
                    vs = visibility_score(None)
                    condition = wmo_to_condition(safe_list_get(daily.get("weather_code"), day_idx))

                # Weighted overall score
                overall = (
                    cs * weights["comfort"]
                    + ps * weights["precipitation"]
                    + ws * weights["wind"]
                    + vs * weights["visibility"]
                )

                city_entry = {
                    "name": loc["name"],
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "overall_score": round(overall, 1),
                    "comfort_score": cs,
                    "precipitation_score": ps,
                    "wind_score": ws,
                    "visibility_score": vs,
                    "condition": condition,
                    "temp_current": current.get("temperature_2m"),
                }
                city_data.append(city_entry)

            # Sort by overall_score descending (deterministic tie-break by name)
            city_data.sort(key=lambda x: (-x["overall_score"], x["name"]))

            best = city_data[0]

            # ── LLM reasoning for comparison narrative ───────────────────────
            scores_table = "\n".join(
                f"{i+1}. {c['name']}: overall={c['overall_score']}, "
                f"comfort={c['comfort_score']}, precip={c['precipitation_score']}, "
                f"wind={c['wind_score']}, visibility={c['visibility_score']}, "
                f"condition={c['condition']}"
                for i, c in enumerate(city_data)
            )

            prompt = f"""You are a travel meteorologist inside a GenLayer Intelligent Contract.
Explain why {best['name']} is the best choice for "{purpose}" travel on {travel_date}.

PRE-COMPUTED RANKED SCORES (authoritative — do NOT override the ranking):
{scores_table}

PURPOSE: {purpose}
TRAVEL DATE: {travel_date}

Respond ONLY with a valid JSON object:
{{
  "best_location": "{best['name']}",
  "reasoning": "<2-3 sentences comparing top options and explaining why best wins>",
  "ranked_locations": <copy the same ranked list with added "rank" key and "reason" per city>,
  "purpose_note": "<one sentence about what matters most for {purpose} travel>"
}}

The ranked_locations list must preserve the pre-computed score ordering exactly.
Each entry: {{"rank": int, "name": str, "overall_score": float, "reason": str, "condition": str}}
"""

            result_str = gl.nondet.exec_prompt(prompt)
            result = json.loads(_extract_json(result_str))

            # Always override with deterministic values
            result["best_location"] = best["name"]
            result["scores"] = city_data
            result["purpose"] = purpose
            result["travel_date"] = travel_date

            return result

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            leader_data = leaders_res.calldata
            try:
                my_result = leader_fn()
                # Best location must match
                if my_result["best_location"] != leader_data.get("best_location"):
                    return False
                # Top-2 overall scores within tolerance
                leader_scores = sorted(
                    leader_data.get("scores", []),
                    key=lambda x: -x["overall_score"],
                )
                my_scores = sorted(
                    my_result.get("scores", []),
                    key=lambda x: -x["overall_score"],
                )
                if not leader_scores or not my_scores:
                    return False
                # Top city overall score within 12 points
                if abs(leader_scores[0]["overall_score"] - my_scores[0]["overall_score"]) > 12:
                    return False
                return True
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.last_comparison = json.dumps(result)
        self.comparison_count = u64(int(self.comparison_count) + 1)
