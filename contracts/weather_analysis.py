# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
WeatherAnalysisContract — reaches strict validator consensus on Open-Meteo data,
then uses an LLM to explain the consensus weather decision.
"""
from genlayer import *
import json


class WeatherAnalysisContract(gl.Contract):
    last_result: str
    analysis_count: u64
    cache_lat: str
    cache_lon: str

    def __init__(self) -> None:
        self.last_result = ""
        self.analysis_count = u64(0)
        self.cache_lat = ""
        self.cache_lon = ""

    @gl.public.view
    def get_analysis(self) -> str:
        return self.last_result

    @gl.public.view
    def get_count(self) -> u64:
        return self.analysis_count

    @gl.public.write.payable
    def analyze_weather(self, lat: str, lon: str, query: str, location_name: str) -> None:
        def leader_fn():
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,apparent_temperature,weather_code,"
                f"wind_speed_10m,wind_gusts_10m,precipitation,relative_humidity_2m,"
                f"pressure_msl,visibility,uv_index"
                f"&hourly=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,"
                f"visibility,uv_index,weather_code"
                f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                f"wind_speed_10m_max,wind_gusts_10m_max,weather_code,"
                f"precipitation_probability_max,uv_index_max"
                f"&forecast_days=7&wind_speed_unit=kmh&temperature_unit=celsius"
                f"&precipitation_unit=mm&timezone=auto"
            )

            raw = gl.nondet.web.get(url).body
            weather = json.loads(raw)

            current = weather.get("current", {})
            daily = weather.get("daily", {})
            hourly = weather.get("hourly", {})

            temp = current.get("temperature_2m") or 20
            feels = current.get("apparent_temperature") or temp
            wind = current.get("wind_speed_10m") or 0
            gusts = current.get("wind_gusts_10m") or 0
            precip = current.get("precipitation") or 0
            humidity = current.get("relative_humidity_2m") or 50
            visibility = current.get("visibility") or 10000
            uv = current.get("uv_index") or 0
            wcode = current.get("weather_code") or 0

            def classify_wmo(code):
                c = int(code) if code else 0
                if c == 0: return "clear"
                if c in (1, 2, 3): return "partly cloudy"
                if c in range(45, 50): return "foggy"
                if c in range(51, 68): return "drizzle/rain"
                if c in range(71, 78): return "snowing"
                if c in range(80, 83): return "rain showers"
                if c in range(85, 87): return "snow showers"
                if c in range(95, 100): return "thunderstorm"
                return "overcast"

            condition = classify_wmo(wcode)

            # Comfort score
            score = 100
            if temp < 0: score -= 40
            elif temp < 5: score -= 25
            elif temp < 10: score -= 10
            elif temp > 38: score -= 40
            elif temp > 32: score -= 20
            elif temp > 28: score -= 8
            if wind > 80: score -= 35
            elif wind > 50: score -= 20
            elif wind > 30: score -= 8
            if precip > 10: score -= 30
            elif precip > 5: score -= 15
            elif precip > 1: score -= 5
            if humidity > 90: score -= 10
            elif humidity < 20: score -= 8
            if visibility < 500: score -= 25
            elif visibility < 2000: score -= 10
            comfort_score = max(0, min(100, score))

            # Risk level
            if (int(wcode) >= 95 or wind > 80 or gusts > 100 or precip > 50 or visibility < 200):
                risk_level = "HIGH"
            elif (int(wcode) in range(71, 78) or int(wcode) in range(45, 50) or wind > 40 or precip > 15 or visibility < 1000 or temp < 0 or temp > 38):
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            # Decision
            if risk_level == "LOW" and comfort_score >= 70:
                decision = "GO"
            elif risk_level == "HIGH" or comfort_score < 40:
                decision = "AVOID"
            else:
                decision = "CAUTION"

            confidence = 90 if risk_level != "MEDIUM" else 72

            # Build reasoning from data
            parts = []
            parts.append(f"Current conditions in {location_name}: {condition}, {temp:.0f}°C (feels like {feels:.0f}°C)")
            if wind > 20:
                parts.append(f"wind {wind:.0f} km/h with gusts to {gusts:.0f} km/h")
            if precip > 0:
                parts.append(f"precipitation {precip:.1f} mm")
            if humidity > 80:
                parts.append(f"humidity {humidity:.0f}%")
            reasoning = ". ".join(parts) + f". Comfort score: {comfort_score}/100, risk level: {risk_level}."

            if decision == "GO":
                recommendation = f"Conditions are favourable — go ahead with your plans in {location_name}."
            elif decision == "AVOID":
                recommendation = f"Conditions are hazardous in {location_name}. Postpone or choose an indoor alternative."
            else:
                recommendation = f"Conditions are mixed in {location_name}. Proceed with caution and monitor the forecast."

            # Key factors
            key_factors = [f"Condition: {condition}", f"Temperature: {temp:.0f}°C", f"Wind: {wind:.0f} km/h"]
            if precip > 0:
                key_factors.append(f"Precipitation: {precip:.1f} mm")
            if uv > 6:
                key_factors.append(f"UV index: {uv:.0f}")

            # Alternative days — find days with lower precip and good temps
            daily_precip = daily.get("precipitation_sum", [])
            daily_temps_max = daily.get("temperature_2m_max", [])
            alt_days = []
            for i in range(1, min(7, len(daily_precip))):
                dp = daily_precip[i] or 0
                dt = daily_temps_max[i] or 20
                if dp < 2 and 10 <= dt <= 30:
                    alt_days.append(i)
            alt_days = alt_days[:3]

            return {
                "decision": decision,
                "confidence": confidence,
                "risk_level": risk_level,
                "comfort_score": comfort_score,
                "condition_class": condition.replace(" ", "_"),
                "reasoning": reasoning,
                "recommendation": recommendation,
                "alternative_days": alt_days,
                "key_factors": key_factors,
                "alerts": [],
                "location": location_name,
                "lat": lat,
                "lon": lon,
                "query": query,
            }

        result = gl.eq_principle.strict_eq(leader_fn)

        def ai_fn():
            prompt = f"""
            You are explaining a GenLayer weather decision that has already been
            computed from validator-consensus weather data. Do not change the
            decision fields.

            Location: {location_name}
            User query: {query}
            Decision: {result["decision"]}
            Risk level: {result["risk_level"]}
            Comfort score: {result["comfort_score"]}
            Key factors: {result["key_factors"]}

            Return JSON with exactly these keys:
            - "decision": repeat the given decision
            - "risk_level": repeat the given risk level
            - "reasoning": one concise sentence grounded in the key factors
            - "recommendation": one practical sentence for the user
            """
            return gl.nondet.exec_prompt(prompt, response_format='json')

        ai_result = gl.eq_principle.strict_eq(ai_fn)
        result["reasoning"] = ai_result.get("reasoning", result["reasoning"])
        result["recommendation"] = ai_result.get("recommendation", result["recommendation"])
        self.last_result = json.dumps(result)
        self.analysis_count = u64(int(self.analysis_count) + 1)
        self.cache_lat = lat
        self.cache_lon = lon
