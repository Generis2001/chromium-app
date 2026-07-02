# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
ActivityRiskContract — evaluates weather suitability for specific activities
with strict validator consensus on weather data and LLM-generated guidance.
"""
from genlayer import *
import json


class ActivityRiskContract(gl.Contract):
    last_assessment: str
    assessment_count: u64

    def __init__(self) -> None:
        self.last_assessment = ""
        self.assessment_count = u64(0)

    @gl.public.view
    def get_assessment(self) -> str:
        return self.last_assessment

    @gl.public.write.payable
    def assess_activity(self, lat: str, lon: str, activity: str, location_name: str, target_date: str, duration_hours: str) -> None:
        CONFIGS = {
            "farming":         {"ideal": (5, 30),  "max_precip": 5,   "max_wind": 30,  "uv": False, "vis": False},
            "outdoor_sports":  {"ideal": (10, 28), "max_precip": 2,   "max_wind": 25,  "uv": True,  "vis": False},
            "construction":    {"ideal": (2, 35),  "max_precip": 10,  "max_wind": 50,  "uv": False, "vis": False},
            "camping":         {"ideal": (8, 28),  "max_precip": 5,   "max_wind": 35,  "uv": True,  "vis": True},
            "photography":     {"ideal": (-5, 40), "max_precip": 1,   "max_wind": 20,  "uv": False, "vis": True},
            "travel":          {"ideal": (0, 38),  "max_precip": 8,   "max_wind": 60,  "uv": False, "vis": True},
            "marathon_running":{"ideal": (10, 20), "max_precip": 5,   "max_wind": 20,  "uv": True,  "vis": False},
            "cycling":         {"ideal": (8, 30),  "max_precip": 3,   "max_wind": 30,  "uv": True,  "vis": False},
            "beach":           {"ideal": (24, 35), "max_precip": 1,   "max_wind": 30,  "uv": True,  "vis": False},
            "skiing":          {"ideal": (-15, 2), "max_precip": 999, "max_wind": 45,  "uv": True,  "vis": True},
        }

        SAFETY_TIPS = {
            "farming":         ["Irrigate if dry", "Secure equipment in high winds", "Take shade breaks in heat"],
            "outdoor_sports":  ["Warm up properly", "Stay hydrated", "Wear UV protection if sunny"],
            "construction":    ["Secure scaffolding in wind", "Halt work in lightning", "Hydrate in heat"],
            "camping":         ["Check tent guy ropes", "Store food safely", "Monitor overnight temps"],
            "photography":     ["Protect lens from rain", "Use ND filter in bright sun", "Bring cleaning kit"],
            "travel":          ["Check airport/road alerts", "Allow extra journey time", "Pack layers"],
            "marathon_running":["Start hydrated", "Run in cooler parts of day", "Watch for heat exhaustion"],
            "cycling":         ["Check tyre pressure", "Wear hi-vis in poor visibility", "Avoid wet road camber"],
            "beach":           ["Apply SPF 50+", "Stay hydrated", "Swim near lifeguards only"],
            "skiing":          ["Check avalanche forecast", "Wear goggles for UV", "Buddy system in low vis"],
        }

        GEAR = {
            "farming":         ["Sun hat", "Waterproof boots"],
            "outdoor_sports":  ["Light rain jacket", "Sun cream SPF30+"],
            "construction":    ["Hard hat", "High-vis jacket", "Gloves"],
            "camping":         ["4-season sleeping bag", "Waterproof tent", "Head torch"],
            "photography":     ["Rain cover for camera", "Lens cloth", "Polarising filter"],
            "travel":          ["Compact umbrella", "Layers", "Waterproof bag cover"],
            "marathon_running":["Moisture-wicking kit", "Electrolyte tabs", "Cap/visor"],
            "cycling":         ["Mudguards", "Waterproof jacket", "Cycling glasses"],
            "beach":           ["SPF 50 sunscreen", "Sun hat", "UV swimwear"],
            "skiing":          ["Goggles", "Thermal base layer", "Avalanche beacon"],
        }

        def leader_fn():
            def to_int(value, default=0):
                if value is None:
                    return default
                return int(round(value))

            act_key = activity.lower().replace(" ", "_")
            if act_key not in CONFIGS:
                act_key = "outdoor_sports"
            cfg = CONFIGS[act_key]

            day_idx = 0
            if target_date == "tomorrow":
                day_idx = 1
            elif target_date.isdigit():
                day_idx = min(int(target_date), 6)

            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,apparent_temperature,weather_code,"
                f"wind_speed_10m,wind_gusts_10m,precipitation,relative_humidity_2m,"
                f"visibility,uv_index"
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

            def sd(key, idx, default=None):
                lst = daily.get(key, [])
                return lst[idx] if lst and len(lst) > idx else default

            if day_idx == 0:
                temp    = current.get("temperature_2m") or 20
                precip  = current.get("precipitation") or 0
                wind    = current.get("wind_speed_10m") or 0
                gusts   = current.get("wind_gusts_10m") or 0
                vis     = current.get("visibility") or 10000
                humidity= current.get("relative_humidity_2m") or 50
                uv      = current.get("uv_index") or 0
                wcode   = current.get("weather_code") or 0
                sunrise = sd("sunrise", 0, "06:00")
                sunset  = sd("sunset", 0, "20:00")
            else:
                temp    = ((sd("temperature_2m_max", day_idx, 20) or 20) + (sd("temperature_2m_min", day_idx, 10) or 10)) / 2
                precip  = sd("precipitation_sum", day_idx, 0) or 0
                wind    = sd("wind_speed_10m_max", day_idx, 0) or 0
                gusts   = sd("wind_gusts_10m_max", day_idx, 0) or 0
                vis     = 8000
                humidity= 60
                uv      = sd("uv_index_max", day_idx, 0) or 0
                wcode   = sd("weather_code", day_idx, 0) or 0
                sunrise = sd("sunrise", day_idx, "06:00")
                sunset  = sd("sunset", day_idx, "20:00")

            ideal_lo, ideal_hi = cfg["ideal"]
            penalty = 0
            concerns = []

            if temp < ideal_lo:
                diff = ideal_lo - temp
                penalty += min(40, diff * 3)
                concerns.append(f"Temperature {temp:.0f}°C is below ideal range ({ideal_lo}°C–{ideal_hi}°C)")
            elif temp > ideal_hi:
                diff = temp - ideal_hi
                penalty += min(40, diff * 3)
                concerns.append(f"Temperature {temp:.0f}°C exceeds ideal range ({ideal_lo}°C–{ideal_hi}°C)")

            if precip > cfg["max_precip"]:
                penalty += min(35, (precip - cfg["max_precip"]) * 4)
                concerns.append(f"Precipitation {precip:.1f} mm exceeds threshold ({cfg['max_precip']} mm)")

            eff_wind = max(wind, gusts * 0.7)
            if eff_wind > cfg["max_wind"]:
                penalty += min(30, (eff_wind - cfg["max_wind"]) * 1.5)
                concerns.append(f"Wind {wind:.0f} km/h (gusts {gusts:.0f} km/h) exceeds safe limit ({cfg['max_wind']} km/h)")

            if cfg["vis"] and vis < 2000:
                penalty += 20 if vis < 500 else 10
                concerns.append(f"Low visibility: {vis:.0f} m")

            if cfg["uv"] and uv > 8:
                penalty += min(20, (uv - 8) * 4)
                concerns.append(f"High UV index: {uv:.0f}")

            wc = int(wcode) if wcode else 0
            if wc >= 95:
                penalty += 50
                concerns.append("Thunderstorm conditions present")
            elif wc >= 80:
                penalty += 20
                concerns.append("Heavy rain showers expected")
            elif wc >= 71 and act_key != "skiing":
                penalty += 25
                concerns.append("Snowfall expected")

            risk_score = int(max(0, min(100, round(100 - penalty))))

            if risk_score >= 75:
                risk_level = "LOW"
                suitability = "SUITABLE"
            elif risk_score >= 50:
                risk_level = "MEDIUM"
                suitability = "MARGINAL"
            else:
                risk_level = "HIGH"
                suitability = "UNSUITABLE"

            act_label = act_key.replace("_", " ").title()

            if suitability == "SUITABLE":
                recommendation = f"Conditions are good for {act_label} in {location_name}. Go ahead with your {duration_hours}-hour session."
            elif suitability == "MARGINAL":
                recommendation = f"Conditions are acceptable for {act_label} in {location_name} but monitor weather closely during your {duration_hours}-hour session."
            else:
                recommendation = f"Conditions are poor for {act_label} in {location_name}. Consider rescheduling your {duration_hours}-hour session."

            if not concerns:
                concerns = [f"Conditions within normal range for {act_label}"]

            # Best time window from sunrise/sunset
            try:
                sr_str = str(sunrise).split("T")[-1][:5] if sunrise else "06:00"
                ss_str = str(sunset).split("T")[-1][:5] if sunset else "20:00"
                if wind > 30 or precip > 2:
                    best_time = f"Early morning ({sr_str}–{sr_str[:2]}:00+2h) before conditions deteriorate"
                elif uv > 7:
                    best_time = f"Morning ({sr_str}–11:00) or late afternoon (16:00–{ss_str}) to avoid peak UV"
                else:
                    best_time = f"Any time between {sr_str} and {ss_str}"
            except Exception:
                best_time = "Morning hours recommended"

            return {
                "activity": activity,
                "suitability": suitability,
                "risk_level": risk_level,
                "risk_score": risk_score,
                "recommendation": recommendation,
                "key_concerns": concerns[:4],
                "safety_tips": SAFETY_TIPS.get(act_key, ["Check local conditions", "Dress appropriately"])[:3],
                "best_time_window": best_time,
                "gear_suggestions": GEAR.get(act_key, ["Weather-appropriate clothing"])[:3],
                "location": location_name,
                "target_date": target_date,
                "duration_hours": duration_hours,
                "metrics": {
                    "temp_c": to_int(temp),
                    "precip_mm": to_int(precip),
                    "wind_kmh": to_int(wind),
                    "gusts_kmh": to_int(gusts),
                    "visibility_m": to_int(vis),
                    "humidity_pct": to_int(humidity),
                    "uv_index": to_int(uv),
                },
            }

        result = gl.eq_principle.strict_eq(leader_fn)
        result["ai_explanation"] = result["recommendation"]
        result["ai_explanation_source"] = "deterministic_fallback"

        self.last_assessment = json.dumps(result)
        self.assessment_count = u64(int(self.assessment_count) + 1)
