# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
WeatherAlertContract — detects extreme weather conditions deterministically.
No LLM calls — all alert text is generated from weather thresholds.
"""
from genlayer import *
import json


ALERT_TITLES = {
    "thunderstorm":       "Thunderstorm Warning",
    "heavy_precipitation":"Heavy Precipitation Warning",
    "extreme_heat":       "Extreme Heat Warning",
    "extreme_cold":       "Extreme Cold Warning",
    "high_wind":          "High Wind Warning",
    "dense_fog":          "Dense Fog Advisory",
    "heavy_snow":         "Heavy Snowfall Warning",
    "extreme_uv":         "Extreme UV Advisory",
    "rapid_pressure_drop":"Rapid Pressure Drop Watch",
}

ALERT_SAFETY = {
    "thunderstorm":       ["Seek indoor shelter immediately", "Stay away from trees and open fields", "Unplug electronic devices"],
    "heavy_precipitation":["Avoid flood-prone areas", "Do not drive through standing water", "Monitor drainage around property"],
    "extreme_heat":       ["Stay hydrated and indoors during peak hours", "Check on elderly neighbours", "Never leave children or pets in vehicles"],
    "extreme_cold":       ["Dress in warm layers", "Limit outdoor exposure", "Watch for signs of frostbite and hypothermia"],
    "high_wind":          ["Secure loose outdoor items", "Avoid travel if possible", "Stay clear of trees and power lines"],
    "dense_fog":          ["Slow down and use fog lights when driving", "Allow extra journey time", "Increase following distance"],
    "heavy_snow":         ["Avoid unnecessary travel", "Keep emergency kit in vehicle", "Clear snow from vents and roofs"],
    "extreme_uv":         ["Apply SPF 50+ sunscreen", "Wear protective clothing and hat", "Seek shade during 10am–4pm"],
    "rapid_pressure_drop":["Monitor updated forecasts closely", "Prepare for deteriorating conditions", "Secure outdoor items in advance"],
}


class WeatherAlertContract(gl.Contract):
    active_alerts: str
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

    @gl.public.write(payable=True)
    def check_alerts(self, lat: str, lon: str, location_name: str, lookahead_hours: str) -> None:
        def leader_fn():
            hours = int(lookahead_hours) if lookahead_hours.isdigit() else 24
            hours = min(max(hours, 6), 72)
            forecast_days = max(1, (hours + 23) // 24)

            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&hourly=temperature_2m,weather_code,wind_speed_10m,"
                f"wind_gusts_10m,precipitation,visibility,pressure_msl,uv_index,snowfall"
                f"&forecast_days={forecast_days}&wind_speed_unit=kmh"
                f"&temperature_unit=celsius&precipitation_unit=mm&timezone=auto"
            )

            raw = gl.nondet.web.get(url).body
            data = json.loads(raw)
            hourly = data.get("hourly", {})

            h_temp   = hourly.get("temperature_2m", [])[:hours]
            h_wcode  = hourly.get("weather_code", [])[:hours]
            h_wind   = hourly.get("wind_speed_10m", [])[:hours]
            h_gusts  = hourly.get("wind_gusts_10m", [])[:hours]
            h_precip = hourly.get("precipitation", [])[:hours]
            h_vis    = hourly.get("visibility", [])[:hours]
            h_pres   = hourly.get("pressure_msl", [])[:hours]
            h_uv     = hourly.get("uv_index", [])[:hours]
            h_snow   = hourly.get("snowfall", [])[:hours]

            def sm(lst): return max((x for x in lst if x is not None), default=0)
            def sn(lst): return min((x for x in lst if x is not None), default=0)
            def ss(lst): return sum(x for x in lst if x is not None)
            def iw(lst, fn): return [i for i, v in enumerate(lst) if v is not None and fn(v)]

            raw_alerts = []

            thunder = iw(h_wcode, lambda c: int(c) >= 95)
            if thunder:
                sev = "EMERGENCY" if len(thunder) >= 3 else "WARNING"
                raw_alerts.append({"type": "thunderstorm", "severity": sev, "affected_hours": thunder, "peak_value": max(int(h_wcode[i]) for i in thunder)})

            tp = ss(h_precip)
            mp = sm(h_precip)
            if tp > 50 or mp > 15:
                sev = "EMERGENCY" if (tp > 100 or mp > 30) else "WARNING"
                raw_alerts.append({"type": "heavy_precipitation", "severity": sev, "affected_hours": iw(h_precip, lambda p: p > 5), "peak_value": round(mp, 1)})

            mx_t = sm(h_temp)
            if mx_t > 38:
                raw_alerts.append({"type": "extreme_heat", "severity": "EMERGENCY" if mx_t > 43 else "WARNING", "affected_hours": iw(h_temp, lambda t: t > 38), "peak_value": round(mx_t, 1)})

            mn_t = sn(h_temp)
            if mn_t < -15:
                raw_alerts.append({"type": "extreme_cold", "severity": "EMERGENCY" if mn_t < -25 else "WARNING", "affected_hours": iw(h_temp, lambda t: t < -15), "peak_value": round(mn_t, 1)})

            mw = sm(h_wind)
            mg = sm(h_gusts)
            if mw > 80 or mg > 100:
                raw_alerts.append({"type": "high_wind", "severity": "EMERGENCY" if (mw > 100 or mg > 130) else "WARNING", "affected_hours": iw(h_wind, lambda w: w > 60), "peak_value": round(mg, 1)})

            mv = sn(h_vis)
            if mv < 500:
                raw_alerts.append({"type": "dense_fog", "severity": "EMERGENCY" if mv < 100 else "WARNING", "affected_hours": iw(h_vis, lambda v: v < 500), "peak_value": round(mv, 0)})

            ts = ss(h_snow)
            ms = sm(h_snow)
            if ts > 20 or ms > 5:
                raw_alerts.append({"type": "heavy_snow", "severity": "EMERGENCY" if ts >= 50 else "WARNING", "affected_hours": iw(h_snow, lambda s: s > 2), "peak_value": round(ms, 1)})

            mu = sm(h_uv)
            if mu >= 11:
                raw_alerts.append({"type": "extreme_uv", "severity": "WARNING", "affected_hours": iw(h_uv, lambda u: u >= 8), "peak_value": round(mu, 1)})

            if len(h_pres) >= 6:
                for i in range(len(h_pres) - 6):
                    p1 = h_pres[i]
                    p2 = h_pres[i + 6]
                    if p1 is not None and p2 is not None and (p1 - p2) > 5:
                        raw_alerts.append({"type": "rapid_pressure_drop", "severity": "WATCH", "affected_hours": list(range(i, min(i + 12, len(h_pres)))), "peak_value": round(p1 - p2, 1)})
                        break

            if not raw_alerts:
                return {
                    "location": location_name, "lat": lat, "lon": lon,
                    "alert_count": 0, "alerts": [], "overall_severity": "NONE",
                    "summary": f"No significant weather alerts for {location_name} in the next {hours} hours.",
                }

            sevs = [a["severity"] for a in raw_alerts]
            overall = "EMERGENCY" if "EMERGENCY" in sevs else ("WARNING" if "WARNING" in sevs else "WATCH")

            alerts = []
            for i, a in enumerate(raw_alerts):
                t = a["type"]
                aff = a.get("affected_hours", [])
                pv = a.get("peak_value", 0)
                desc_parts = {
                    "thunderstorm":        f"Thunderstorm activity detected with WMO code {pv:.0f} across {len(aff)} affected hours.",
                    "heavy_precipitation": f"Total precipitation of {ss(h_precip):.0f} mm expected with peak hourly rate of {pv} mm.",
                    "extreme_heat":        f"Temperatures reaching {pv}°C detected across {len(aff)} hours.",
                    "extreme_cold":        f"Temperatures dropping to {pv}°C detected across {len(aff)} hours.",
                    "high_wind":           f"Wind gusts up to {pv} km/h expected across {len(aff)} hours.",
                    "dense_fog":           f"Visibility dropping to {pv:.0f} m detected across {len(aff)} hours.",
                    "heavy_snow":          f"Snowfall up to {pv} cm/h expected across {len(aff)} hours.",
                    "extreme_uv":          f"UV index reaching {pv:.0f} across {len(aff)} hours.",
                    "rapid_pressure_drop": f"Pressure drop of {pv} hPa detected over 6 hours — storm front approaching.",
                }
                alerts.append({
                    "id": f"{t}_{i}",
                    "type": t,
                    "severity": a["severity"],
                    "title": ALERT_TITLES.get(t, t.replace("_", " ").title()),
                    "description": desc_parts.get(t, f"{t.replace('_', ' ').title()} conditions detected."),
                    "peak_value": pv,
                    "affected_hours": aff,
                    "safety_actions": ALERT_SAFETY.get(t, ["Monitor local weather", "Take appropriate precautions", "Follow official guidance"]),
                    "expires_hours": len(aff) if aff else hours,
                })

            summary_parts = [f"{overall} level alert for {location_name}"]
            types = [a["type"].replace("_", " ") for a in raw_alerts]
            summary_parts.append(f"Active conditions: {', '.join(types)}")
            summary_parts.append(f"Covering the next {hours} hours.")

            return {
                "location": location_name, "lat": lat, "lon": lon,
                "alert_count": len(alerts),
                "alerts": alerts,
                "overall_severity": overall,
                "summary": " ".join(summary_parts),
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            try:
                data = leaders_res.calldata
                return (
                    data.get("overall_severity") in ("NONE", "WATCH", "WARNING", "EMERGENCY")
                    and isinstance(data.get("alert_count"), (int, float))
                    and isinstance(data.get("alerts"), list)
                )
            except Exception:
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.active_alerts = json.dumps(result)
        self.alert_count = u64(int(self.alert_count) + 1)
        self.last_checked_lat = lat
        self.last_checked_lon = lon
