# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
TravelComparisonContract — compares multiple cities for a specific travel purpose
using deterministic scoring only (no LLM calls).
"""
from genlayer import *
import json


class TravelComparisonContract(gl.Contract):
    last_comparison: str
    comparison_count: u64

    def __init__(self) -> None:
        self.last_comparison = ""
        self.comparison_count = u64(0)

    @gl.public.view
    def get_comparison(self) -> str:
        return self.last_comparison

    @gl.public.write(payable=True)
    def compare_locations(self, locations_json: str, purpose: str, travel_date: str) -> None:
        PURPOSE_WEIGHTS = {
            "travel":        {"comfort": 0.35, "precipitation": 0.30, "wind": 0.20, "visibility": 0.15},
            "business":      {"comfort": 0.40, "precipitation": 0.25, "wind": 0.15, "visibility": 0.20},
            "outdoor_sports":{"comfort": 0.25, "precipitation": 0.30, "wind": 0.25, "visibility": 0.20},
            "photography":   {"comfort": 0.20, "precipitation": 0.20, "wind": 0.15, "visibility": 0.45},
            "hiking":        {"comfort": 0.30, "precipitation": 0.30, "wind": 0.25, "visibility": 0.15},
            "beach":         {"comfort": 0.40, "precipitation": 0.25, "wind": 0.20, "visibility": 0.15},
        }

        PURPOSE_NOTES = {
            "travel":        "Comfort and low precipitation are most important for general travel.",
            "business":      "Comfort and reliable visibility matter most for business travel.",
            "outdoor_sports":"Precipitation and wind are the key factors for outdoor sports.",
            "photography":   "Visibility and light quality are critical for photography conditions.",
            "hiking":        "Low precipitation and manageable wind are essential for hiking.",
            "beach":         "Warmth, sunshine, and calm winds define the ideal beach day.",
        }

        def leader_fn():
            locations = json.loads(locations_json)
            if len(locations) > 5:
                locations = locations[:5]

            weights = PURPOSE_WEIGHTS.get(purpose, PURPOSE_WEIGHTS["travel"])

            day_idx = 0
            if travel_date == "tomorrow":
                day_idx = 1
            elif travel_date in ("weekend", "saturday"):
                day_idx = 5
            elif travel_date == "sunday":
                day_idx = 6

            def precip_score(mm):
                if mm is None: return 80
                if mm == 0: return 100
                if mm < 1: return 90
                if mm < 5: return 70
                if mm < 15: return 45
                if mm < 30: return 20
                return 5

            def wind_score(w, g):
                top = max(w or 0, g or 0)
                if top < 10: return 100
                if top < 20: return 90
                if top < 35: return 70
                if top < 50: return 50
                if top < 70: return 25
                return 5

            def comfort_score(t_max, t_min):
                if t_max is None or t_min is None: return 70
                avg = (t_max + t_min) / 2
                s = 100
                if avg < 0: s -= 40
                elif avg < 8: s -= 20
                elif avg < 15: s -= 5
                elif avg > 38: s -= 40
                elif avg > 32: s -= 20
                elif avg > 28: s -= 8
                return max(0, min(100, s))

            def visibility_score(v):
                if v is None: return 80
                if v >= 10000: return 100
                if v >= 5000: return 85
                if v >= 2000: return 60
                if v >= 500: return 30
                return 5

            def wmo_condition(code):
                if code is None: return "unknown"
                c = int(code)
                if c == 0: return "clear"
                if c in (1, 2, 3): return "partly cloudy"
                if c in range(45, 50): return "foggy"
                if c in range(51, 68): return "rain"
                if c in range(71, 78): return "snow"
                if c in range(80, 83): return "showers"
                if c in range(95, 100): return "thunderstorm"
                return "overcast"

            def sl(lst, idx, default=None):
                return lst[idx] if lst and len(lst) > idx else default

            city_data = []
            for loc in locations:
                url = (
                    f"https://api.open-meteo.com/v1/forecast"
                    f"?latitude={loc['lat']}&longitude={loc['lon']}"
                    f"&current=temperature_2m,apparent_temperature,weather_code,"
                    f"wind_speed_10m,wind_gusts_10m,precipitation,visibility"
                    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                    f"wind_speed_10m_max,wind_gusts_10m_max,weather_code,"
                    f"precipitation_probability_max"
                    f"&forecast_days=7&wind_speed_unit=kmh&temperature_unit=celsius"
                    f"&precipitation_unit=mm&timezone=auto"
                )
                raw = gl.nondet.web.get(url).body
                data = json.loads(raw)
                current = data.get("current", {})
                daily = data.get("daily", {})

                if day_idx == 0:
                    ps = precip_score(current.get("precipitation"))
                    ws = wind_score(current.get("wind_speed_10m"), current.get("wind_gusts_10m"))
                    cs = comfort_score(current.get("temperature_2m"), current.get("apparent_temperature"))
                    vs = visibility_score(current.get("visibility"))
                    cond = wmo_condition(current.get("weather_code"))
                    temp_c = current.get("temperature_2m")
                else:
                    ps = precip_score(sl(daily.get("precipitation_sum"), day_idx))
                    ws = wind_score(sl(daily.get("wind_speed_10m_max"), day_idx), sl(daily.get("wind_gusts_10m_max"), day_idx))
                    cs = comfort_score(sl(daily.get("temperature_2m_max"), day_idx), sl(daily.get("temperature_2m_min"), day_idx))
                    vs = visibility_score(None)
                    cond = wmo_condition(sl(daily.get("weather_code"), day_idx))
                    t_max = sl(daily.get("temperature_2m_max"), day_idx) or 20
                    t_min = sl(daily.get("temperature_2m_min"), day_idx) or 10
                    temp_c = (t_max + t_min) / 2

                overall = round(
                    cs * weights["comfort"] +
                    ps * weights["precipitation"] +
                    ws * weights["wind"] +
                    vs * weights["visibility"],
                    1
                )

                city_data.append({
                    "name": loc["name"],
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "overall_score": overall,
                    "comfort_score": cs,
                    "precipitation_score": ps,
                    "wind_score": ws,
                    "visibility_score": vs,
                    "condition": cond,
                    "temp_current": temp_c,
                })

            city_data.sort(key=lambda x: (-x["overall_score"], x["name"]))
            best = city_data[0]
            runner_up = city_data[1] if len(city_data) > 1 else None

            # Build reasoning from scores
            reasoning_parts = [
                f"{best['name']} ranks first with a weather score of {best['overall_score']:.0f}/100 "
                f"({best['condition']} conditions"
                + (f", {best['temp_current']:.0f}°C" if best['temp_current'] is not None else "")
                + ")"
            ]
            if runner_up:
                gap = best["overall_score"] - runner_up["overall_score"]
                reasoning_parts.append(
                    f"{runner_up['name']} scores {runner_up['overall_score']:.0f} "
                    f"({gap:.0f} points behind, {runner_up['condition']})"
                )
            reasoning = ". ".join(reasoning_parts) + f" for {purpose} on {travel_date}."

            ranked = []
            for i, c in enumerate(city_data):
                score_desc = []
                if c["comfort_score"] >= 80: score_desc.append("comfortable temps")
                elif c["comfort_score"] < 50: score_desc.append("uncomfortable temps")
                if c["precipitation_score"] >= 90: score_desc.append("dry")
                elif c["precipitation_score"] < 50: score_desc.append("wet")
                if c["wind_score"] >= 90: score_desc.append("calm")
                elif c["wind_score"] < 50: score_desc.append("windy")
                reason = f"{c['condition'].title()}" + (f", {', '.join(score_desc)}" if score_desc else "") + f". Score: {c['overall_score']:.0f}/100"
                ranked.append({
                    "rank": i + 1,
                    "name": c["name"],
                    "overall_score": c["overall_score"],
                    "reason": reason,
                    "condition": c["condition"],
                })

            return {
                "best_location": best["name"],
                "reasoning": reasoning,
                "ranked_locations": ranked,
                "purpose_note": PURPOSE_NOTES.get(purpose, f"Weather ranked for {purpose} travel."),
                "scores": city_data,
                "purpose": purpose,
                "travel_date": travel_date,
                "partial_failures": [],
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                leader_data = leaders_res.calldata
                my_result = leader_fn()
                if my_result["best_location"] != leader_data.get("best_location"):
                    return False
                ls = sorted(leader_data.get("scores", []), key=lambda x: -x["overall_score"])
                ms = sorted(my_result.get("scores", []), key=lambda x: -x["overall_score"])
                if not ls or not ms:
                    return False
                if abs(ls[0]["overall_score"] - ms[0]["overall_score"]) > 12:
                    return False
                return True
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.last_comparison = json.dumps(result)
        self.comparison_count = u64(int(self.comparison_count) + 1)
