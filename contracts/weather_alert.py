# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
WeatherAlertContract — detects extreme weather conditions and generates
structured alerts with severity levels.

Detected conditions:
- Severe thunderstorms (WMO codes 95-99)
- Heavy precipitation (>50 mm/day)
- Extreme heat (>40°C) / extreme cold (<-20°C)
- High wind / gale (>80 km/h sustained, >100 km/h gusts)
- Dense fog (visibility <200 m)
- Heavy snowfall (>30 cm/day)
- UV extreme (UV index >11)
- Rapid pressure drop (storm front approach)

Each alert has: id, type, severity (WATCH|WARNING|EMERGENCY),
affected_hours, title, description, safety_actions.

Validators confirm alert set within ±1 alert count and all EMERGENCY alerts match.
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


class WeatherAlertContract(gl.Contract):
    # ─── persistent state ───────────────────────────────────────────────────────
    active_alerts: str      # JSON list of current alerts
    alert_count: u64
    last_checked_lat: str
    last_checked_lon: str

    def __init__(self) -> None:
        self.active_alerts = "[]"
        self.alert_count = u64(0)
        self.last_checked_lat = ""
        self.last_checked_lon = ""

    @gl.public.view
    def get_alerts(self) -> str:
        return self.active_alerts

    @gl.public.view
    def get_alert_count(self) -> u64:
        return self.alert_count

    @gl.public.write
    def check_alerts(
        self,
        lat: str,
        lon: str,
        location_name: str,
        lookahead_hours: str,  # "24" | "48" | "72"
    ) -> None:
        """
        Scan weather forecast for the location and produce structured alerts.
        All threshold evaluation is deterministic; LLM expands alert descriptions.
        """

        def leader_fn():
            hours = int(lookahead_hours) if lookahead_hours.isdigit() else 24
            hours = min(max(hours, 24), 72)
            forecast_days = (hours + 23) // 24  # ceil

            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,weather_code,wind_speed_10m,"
                f"wind_gusts_10m,precipitation,visibility,pressure_msl,uv_index"
                f"&hourly=temperature_2m,weather_code,wind_speed_10m,"
                f"wind_gusts_10m,precipitation,visibility,pressure_msl,uv_index,"
                f"snowfall,snow_depth"
                f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,"
                f"snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code,"
                f"uv_index_max,precipitation_probability_max"
                f"&forecast_days={forecast_days}&wind_speed_unit=kmh"
                f"&temperature_unit=celsius&precipitation_unit=mm&timezone=auto"
            )

            raw = gl.nondet.web.get(url).body
            data = json.loads(raw)

            current = data.get("current", {})
            hourly = data.get("hourly", {})
            daily = data.get("daily", {})

            # Slice to lookahead window
            h_temp = hourly.get("temperature_2m", [])[:hours]
            h_wcode = hourly.get("weather_code", [])[:hours]
            h_wind = hourly.get("wind_speed_10m", [])[:hours]
            h_gusts = hourly.get("wind_gusts_10m", [])[:hours]
            h_precip = hourly.get("precipitation", [])[:hours]
            h_vis = hourly.get("visibility", [])[:hours]
            h_pressure = hourly.get("pressure_msl", [])[:hours]
            h_uv = hourly.get("uv_index", [])[:hours]
            h_snow = hourly.get("snowfall", [])[:hours]

            # ── deterministic alert detection ────────────────────────────────
            raw_alerts = []

            def safe_max(lst):
                filtered = [x for x in lst if x is not None]
                return max(filtered) if filtered else 0

            def safe_min(lst):
                filtered = [x for x in lst if x is not None]
                return min(filtered) if filtered else 0

            def safe_sum(lst):
                return sum(x for x in lst if x is not None)

            def indices_where(lst, fn):
                return [i for i, v in enumerate(lst) if v is not None and fn(v)]

            # 1. Thunderstorm
            thunder_indices = indices_where(h_wcode, lambda c: int(c) >= 95)
            if thunder_indices:
                severity = "EMERGENCY" if len(thunder_indices) >= 3 else "WARNING"
                raw_alerts.append({
                    "type": "thunderstorm",
                    "severity": severity,
                    "affected_hours": thunder_indices,
                    "peak_value": max(int(h_wcode[i]) for i in thunder_indices),
                })

            # 2. Heavy precipitation
            total_precip = safe_sum(h_precip)
            max_hourly_precip = safe_max(h_precip)
            if total_precip > 50 or max_hourly_precip > 15:
                severity = "EMERGENCY" if (total_precip > 100 or max_hourly_precip > 30) else "WARNING"
                raw_alerts.append({
                    "type": "heavy_precipitation",
                    "severity": severity,
                    "affected_hours": indices_where(h_precip, lambda p: p > 5),
                    "peak_value": round(max_hourly_precip, 1),
                    "total_mm": round(total_precip, 1),
                })

            # 3. Extreme heat
            max_temp = safe_max(h_temp)
            if max_temp > 38:
                severity = "EMERGENCY" if max_temp > 43 else "WARNING"
                raw_alerts.append({
                    "type": "extreme_heat",
                    "severity": severity,
                    "affected_hours": indices_where(h_temp, lambda t: t > 38),
                    "peak_value": round(max_temp, 1),
                })

            # 4. Extreme cold
            min_temp = safe_min(h_temp)
            if min_temp < -15:
                severity = "EMERGENCY" if min_temp < -25 else "WARNING"
                raw_alerts.append({
                    "type": "extreme_cold",
                    "severity": severity,
                    "affected_hours": indices_where(h_temp, lambda t: t < -15),
                    "peak_value": round(min_temp, 1),
                })

            # 5. High wind
            max_wind = safe_max(h_wind)
            max_gusts = safe_max(h_gusts)
            if max_wind > 80 or max_gusts > 100:
                severity = "EMERGENCY" if (max_wind > 100 or max_gusts > 130) else "WARNING"
                raw_alerts.append({
                    "type": "high_wind",
                    "severity": severity,
                    "affected_hours": indices_where(h_wind, lambda w: w > 60),
                    "peak_value": round(max_gusts, 1),
                    "max_sustained_kmh": round(max_wind, 1),
                })

            # 6. Dense fog
            min_vis = safe_min(h_vis)
            if min_vis < 500:
                severity = "EMERGENCY" if min_vis < 100 else "WARNING"
                fog_hours = indices_where(h_vis, lambda v: v < 500)
                raw_alerts.append({
                    "type": "dense_fog",
                    "severity": severity,
                    "affected_hours": fog_hours,
                    "peak_value": round(min_vis, 0),
                })

            # 7. Heavy snow
            total_snow = safe_sum(h_snow)
            max_hourly_snow = safe_max(h_snow)
            if total_snow > 20 or max_hourly_snow > 5:
                severity = "WARNING" if total_snow < 50 else "EMERGENCY"
                raw_alerts.append({
                    "type": "heavy_snow",
                    "severity": severity,
                    "affected_hours": indices_where(h_snow, lambda s: s > 2),
                    "peak_value": round(max_hourly_snow, 1),
                    "total_cm": round(total_snow, 1),
                })

            # 8. UV extreme
            max_uv = safe_max(h_uv)
            if max_uv >= 11:
                raw_alerts.append({
                    "type": "extreme_uv",
                    "severity": "WARNING",
                    "affected_hours": indices_where(h_uv, lambda u: u >= 8),
                    "peak_value": round(max_uv, 1),
                })

            # 9. Rapid pressure drop (storm front)
            if len(h_pressure) >= 6:
                # Check 6-hour rolling windows for drops > 5 hPa
                for i in range(len(h_pressure) - 6):
                    p1 = h_pressure[i]
                    p2 = h_pressure[i + 6]
                    if p1 is not None and p2 is not None and (p1 - p2) > 5:
                        raw_alerts.append({
                            "type": "rapid_pressure_drop",
                            "severity": "WATCH",
                            "affected_hours": list(range(i, min(i + 12, len(h_pressure)))),
                            "peak_value": round(p1 - p2, 1),
                        })
                        break  # one alert per scan

            # ── LLM expansion ─────────────────────────────────────────────
            if not raw_alerts:
                # No alerts — return clean result without LLM call
                return {
                    "location": location_name,
                    "lat": lat,
                    "lon": lon,
                    "alert_count": 0,
                    "alerts": [],
                    "overall_severity": "NONE",
                    "summary": "No significant weather alerts for this location in the next "
                               f"{hours} hours.",
                }

            # Determine overall severity
            severities = [a["severity"] for a in raw_alerts]
            if "EMERGENCY" in severities:
                overall_severity = "EMERGENCY"
            elif "WARNING" in severities:
                overall_severity = "WARNING"
            else:
                overall_severity = "WATCH"

            prompt = f"""You are a National Weather Service meteorologist embedded in a GenLayer Intelligent Contract.
Generate structured weather alerts for {location_name}.

DETECTED RAW ALERTS (authoritative — do NOT change type, severity, or peak_value):
{json.dumps(raw_alerts, indent=2)}

OVERALL SEVERITY: {overall_severity}
LOOKAHEAD WINDOW: {hours} hours

For each alert, expand it into a full alert object. Respond ONLY with valid JSON:
{{
  "location": "{location_name}",
  "alert_count": {len(raw_alerts)},
  "overall_severity": "{overall_severity}",
  "summary": "<1-2 sentence overall situation summary>",
  "alerts": [
    {{
      "id": "<type>_<index>",
      "type": "<exact type from raw>",
      "severity": "<exact severity from raw>",
      "title": "<short alert title e.g. 'Severe Thunderstorm Warning'>",
      "description": "<2 sentence meteorological explanation>",
      "peak_value": <exact peak_value from raw>,
      "affected_hours": <exact affected_hours from raw>,
      "safety_actions": [<list of 3 specific safety actions>],
      "expires_hours": <estimated hours until alert expires, integer>
    }}
  ]
}}

CRITICAL: Do not change type, severity, peak_value, or affected_hours from the raw data.
"""

            try:
                result_str = gl.nondet.exec_prompt(prompt)
                result = json.loads(_extract_json(result_str))
            except Exception:
                result = {
                    "location": location_name,
                    "alert_count": len(raw_alerts),
                    "overall_severity": overall_severity,
                    "summary": f"{len(raw_alerts)} weather alert(s) detected for {location_name} in the next {hours} hours.",
                    "alerts": [
                        {
                            "id": f"{a['type']}_{i}",
                            "type": a["type"],
                            "severity": a["severity"],
                            "title": a["type"].replace("_", " ").title(),
                            "description": f"{a['type'].replace('_', ' ').title()} conditions detected.",
                            "peak_value": a.get("peak_value", 0),
                            "affected_hours": a.get("affected_hours", []),
                            "safety_actions": ["Monitor local weather updates", "Take appropriate precautions", "Follow official guidance"],
                            "expires_hours": 24,
                        }
                        for i, a in enumerate(raw_alerts)
                    ],
                }

            # Enforce deterministic fields
            result["location"] = location_name
            result["lat"] = lat
            result["lon"] = lon
            result["alert_count"] = len(raw_alerts)
            result["overall_severity"] = overall_severity

            # Patch each alert with deterministic values from raw_alerts
            if "alerts" in result:
                for i, alert in enumerate(result["alerts"]):
                    if i < len(raw_alerts):
                        raw = raw_alerts[i]
                        alert["type"] = raw["type"]
                        alert["severity"] = raw["severity"]
                        alert["peak_value"] = raw["peak_value"]
                        alert["affected_hours"] = raw["affected_hours"]

            return result

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            leader_data = leaders_res.calldata
            try:
                my_result = leader_fn()
                # Alert count within ±1 (minor timing differences)
                leader_count = int(leader_data.get("alert_count", 0))
                my_count = int(my_result.get("alert_count", 0))
                if abs(leader_count - my_count) > 1:
                    return False
                # Overall severity must match
                if my_result.get("overall_severity") != leader_data.get("overall_severity"):
                    return False
                # All EMERGENCY alerts must be in both results
                leader_alerts = {a["type"] for a in leader_data.get("alerts", [])
                                 if a.get("severity") == "EMERGENCY"}
                my_alerts = {a["type"] for a in my_result.get("alerts", [])
                             if a.get("severity") == "EMERGENCY"}
                if leader_alerts != my_alerts:
                    return False
                return True
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.active_alerts = json.dumps(result)
        self.alert_count = u64(int(self.alert_count) + 1)
        self.last_checked_lat = lat
        self.last_checked_lon = lon
