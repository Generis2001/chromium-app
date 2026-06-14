# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ActivityRiskContract — evaluates weather suitability for specific activities.
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


class ActivityRiskContract(gl.Contract):
    last_assessment: str
    assessment_count: u64

    def __init__(self) -> None:
        self.last_assessment = ""
        self.assessment_count = u64(0)

    @gl.public.view
    def get_assessment(self) -> str:
        return self.last_assessment

    @gl.public.write
    def assess_activity(
        self,
        lat: str,
        lon: str,
        activity: str,
        location_name: str,
        target_date: str,
        duration_hours: str,
    ) -> None:
        ACTIVITY_CONFIGS = {
            "farming": {"ideal_temp_range": (5, 30), "max_precip_mm": 5, "max_wind_kmh": 30, "uv_concern": False, "visibility_critical": False},
            "outdoor_sports": {"ideal_temp_range": (10, 28), "max_precip_mm": 2, "max_wind_kmh": 25, "uv_concern": True, "visibility_critical": False},
            "construction": {"ideal_temp_range": (2, 35), "max_precip_mm": 10, "max_wind_kmh": 50, "uv_concern": False, "visibility_critical": False},
            "camping": {"ideal_temp_range": (8, 28), "max_precip_mm": 5, "max_wind_kmh": 35, "uv_concern": True, "visibility_critical": True},
            "photography": {"ideal_temp_range": (-5, 40), "max_precip_mm": 1, "max_wind_kmh": 20, "uv_concern": False, "visibility_critical": True},
            "travel": {"ideal_temp_range": (0, 38), "max_precip_mm": 8, "max_wind_kmh": 60, "uv_concern": False, "visibility_critical": True},
            "marathon_running": {"ideal_temp_range": (10, 20), "max_precip_mm": 5, "max_wind_kmh": 20, "uv_concern": True, "visibility_critical": False},
            "cycling": {"ideal_temp_range": (8, 30), "max_precip_mm": 3, "max_wind_kmh": 30, "uv_concern": True, "visibility_critical": False},
            "beach": {"ideal_temp_range": (24, 35), "max_precip_mm": 1, "max_wind_kmh": 30, "uv_concern": True, "visibility_critical": False},
            "skiing": {"ideal_temp_range": (-15, 2), "max_precip_mm": 999, "max_wind_kmh": 45, "uv_concern": True, "visibility_critical": True},
        }

        def leader_fn():
            try:
                act_key = activity.lower().replace(" ", "_")
                if act_key not in ACTIVITY_CONFIGS:
                    act_key = "outdoor_sports"
                config = ACTIVITY_CONFIGS[act_key]

                day_idx = 0
                if target_date == "tomorrow":
                    day_idx = 1
                elif target_date.isdigit():
                    day_idx = min(int(target_date), 6)

                url = (
                    f"https://api.open-meteo.com/v1/forecast"
                    f"?latitude={lat}&longitude={lon}"
                    f"&current=temperature_2m,apparent_temperature,weather_code,"
                    f"wind_speed_10m,wind_gusts_10m,precipitation,rain,snowfall,"
                    f"relative_humidity_2m,visibility,uv_index,pressure_msl"
                    f"&hourly=temperature_2m,precipitation,wind_speed_10m,"
                    f"wind_gusts_10m,visibility,uv_index,relative_humidity_2m,weather_code"
                    f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                    f"wind_speed_10m_max,wind_gusts_10m_max,weather_code,"
                    f"precipitation_probability_max,uv_index_max,sunrise,sunset"
                    f"&forecast_days=7&wind_speed_unit=kmh&temperature_unit=celsius"
                    f"&precipitation_unit=mm&timezone=auto"
                )

                raw = gl.nondet.web.get(url).body
                data = json.loads(raw)

                current = data.get("current", {})
                daily = data.get("daily", {})

                def safe_daily(key, idx, default=None):
                    lst = daily.get(key, [])
                    return lst[idx] if lst and len(lst) > idx else default

                if day_idx == 0:
                    temp = current.get("temperature_2m") or 20
                    precip = current.get("precipitation") or 0
                    wind = current.get("wind_speed_10m") or 0
                    gusts = current.get("wind_gusts_10m") or 0
                    visibility = current.get("visibility") or 10000
                    humidity = current.get("relative_humidity_2m") or 50
                    uv = current.get("uv_index") or 0
                    weather_code = current.get("weather_code") or 0
                else:
                    temp = (
                        (safe_daily("temperature_2m_max", day_idx, 20) +
                         safe_daily("temperature_2m_min", day_idx, 10)) / 2
                    )
                    precip = safe_daily("precipitation_sum", day_idx, 0) or 0
                    wind = safe_daily("wind_speed_10m_max", day_idx, 0) or 0
                    gusts = safe_daily("wind_gusts_10m_max", day_idx, 0) or 0
                    visibility = 8000
                    humidity = 60
                    uv = safe_daily("uv_index_max", day_idx, 0) or 0
                    weather_code = safe_daily("weather_code", day_idx, 0) or 0

                ideal_low, ideal_high = config["ideal_temp_range"]
                max_precip = config["max_precip_mm"]
                max_wind = config["max_wind_kmh"]

                penalty = 0
                if temp < ideal_low:
                    penalty += min(40, (ideal_low - temp) * 3)
                elif temp > ideal_high:
                    penalty += min(40, (temp - ideal_high) * 3)
                if precip > max_precip:
                    penalty += min(35, (precip - max_precip) * 4)
                effective_wind = max(wind, gusts * 0.7)
                if effective_wind > max_wind:
                    penalty += min(30, (effective_wind - max_wind) * 1.5)
                if config["visibility_critical"]:
                    if visibility < 500:
                        penalty += 30
                    elif visibility < 2000:
                        penalty += 15
                    elif visibility < 5000:
                        penalty += 5
                if config["uv_concern"] and uv > 8:
                    penalty += min(20, (uv - 8) * 4)
                wc = int(weather_code) if weather_code else 0
                if wc >= 95:
                    penalty += 50
                elif wc >= 80:
                    penalty += 20
                elif wc >= 71:
                    if act_key != "skiing":
                        penalty += 25

                risk_score = max(0, min(100, 100 - penalty))
                if risk_score >= 75:
                    risk_level = "LOW"
                    suitability = "SUITABLE"
                elif risk_score >= 50:
                    risk_level = "MEDIUM"
                    suitability = "MARGINAL"
                else:
                    risk_level = "HIGH"
                    suitability = "UNSUITABLE"

                prompt = f"""You are a specialist weather consultant embedded in a GenLayer Intelligent Contract.
Assess conditions for {activity} at {location_name}.

ACTIVITY: {activity}
DURATION: {duration_hours} hours
TARGET DATE: {target_date}

WEATHER METRICS:
- Temperature: {temp:.1f}°C
- Precipitation: {precip:.1f} mm
- Wind: {wind:.0f} km/h (gusts {gusts:.0f} km/h)
- Visibility: {visibility:.0f} m
- Humidity: {humidity:.0f}%
- UV Index: {uv:.1f}

PRE-COMPUTED SCORES (authoritative — do NOT override):
- risk_score: {risk_score}/100
- risk_level: {risk_level}
- suitability: {suitability}

Respond ONLY with a valid JSON object:
{{
  "activity": "{activity}",
  "suitability": "{suitability}",
  "risk_level": "{risk_level}",
  "risk_score": {risk_score},
  "recommendation": "<one clear actionable sentence for this activity>",
  "key_concerns": [<list of 2-4 specific weather concerns for this activity>],
  "safety_tips": [<list of 2-3 actionable safety tips relevant to conditions>],
  "best_time_window": "<e.g. 'Early morning 6-9am before wind picks up'>",
  "gear_suggestions": [<list of 1-3 weather-appropriate gear items>]
}}

risk_level and risk_score MUST match pre-computed values exactly.
"""

                try:
                    result_str = gl.nondet.exec_prompt(prompt)
                    result = json.loads(_extract_json(result_str))
                except Exception:
                    result = {
                        "activity": activity,
                        "suitability": suitability,
                        "risk_level": risk_level,
                        "risk_score": risk_score,
                        "recommendation": f"Conditions rated {suitability.lower()} for {activity}. Risk score: {risk_score}/100.",
                        "key_concerns": [f"Risk level: {risk_level}"],
                        "safety_tips": ["Monitor local weather conditions before proceeding"],
                        "best_time_window": "Check hourly forecast for optimal window",
                        "gear_suggestions": ["Dress appropriately for current conditions"],
                    }

                result["risk_level"] = risk_level
                result["risk_score"] = risk_score
                result["suitability"] = suitability
                result["activity"] = activity
                result["location"] = location_name
                result["target_date"] = target_date
                result["duration_hours"] = duration_hours
                result["metrics"] = {
                    "temp_c": round(temp, 1),
                    "precip_mm": round(precip, 1),
                    "wind_kmh": round(wind, 0),
                    "gusts_kmh": round(gusts, 0),
                    "visibility_m": round(visibility, 0),
                    "humidity_pct": round(humidity, 0),
                    "uv_index": round(uv, 1),
                }
                return result

            except Exception:
                return {
                    "activity": activity,
                    "suitability": "MARGINAL",
                    "risk_level": "MEDIUM",
                    "risk_score": 50,
                    "recommendation": f"Weather data unavailable for {location_name}. Please try again.",
                    "key_concerns": ["Data unavailable"],
                    "safety_tips": ["Check a local forecast before proceeding"],
                    "best_time_window": "Unable to determine",
                    "gear_suggestions": ["Prepare for variable conditions"],
                    "location": location_name,
                    "target_date": target_date,
                    "duration_hours": duration_hours,
                    "metrics": {},
                }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            leader_data = leaders_res.calldata
            try:
                my_result = leader_fn()
                if my_result["risk_level"] != leader_data.get("risk_level"):
                    return False
                leader_score = int(leader_data.get("risk_score", 0))
                my_score = int(my_result.get("risk_score", 0))
                if abs(leader_score - my_score) > 10:
                    return False
                if my_result["suitability"] != leader_data.get("suitability"):
                    return False
                return True
            except Exception:
                return False

        try:
            result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        except Exception:
            result = {
                "activity": activity,
                "suitability": "MARGINAL",
                "risk_level": "MEDIUM",
                "risk_score": 50,
                "recommendation": f"Assessment consensus could not be reached for {location_name}. Please try again.",
                "key_concerns": ["Consensus failed"],
                "safety_tips": ["Try again in a few moments"],
                "best_time_window": "Unable to determine",
                "gear_suggestions": ["Prepare for variable conditions"],
                "location": location_name,
                "target_date": target_date,
                "duration_hours": duration_hours,
                "metrics": {},
            }

        self.last_assessment = json.dumps(result)
        self.assessment_count = u64(int(self.assessment_count) + 1)
