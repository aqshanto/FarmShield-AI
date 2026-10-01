"""Turns a farm dashboard into a plain-language fact sheet for the AI assistant.

The assistant only knows what this sheet says, so it must carry everything a farmer may ask
about (risks, reasons, actions, forecast) and nothing a farmer shouldn't hear (raw indices).
"""

from datetime import date, timedelta

from app.schemas.dashboard import Dashboard, DayForecast, RiskModuleSummary

LEVEL_WORDS = {"safe": "safe", "watch": "watch closely", "warning": "warning", "danger": "danger"}
MODULE_NAMES = {"flood_risk": "Flood risk", "water_stress": "Water for the crop", "crop_health": "Crop health"}
CONDITION_WORDS = {"sunny": "sunny", "partly_cloudy": "partly cloudy", "cloudy": "cloudy", "rain": "rain", "storm": "storm"}


def influence(score: int) -> str:
    return "strong" if score >= 60 else "some" if score >= 30 else "little"


def rain_total(forecast: list[DayForecast], today: date, days: int) -> float:
    """Forecast rain from today through today + days - 1."""
    return sum(d.rain_mm for d in forecast if today <= d.date < today + timedelta(days=days))


def _module_lines(m: RiskModuleSummary) -> list[str]:
    origin = "today's NASA satellite data" if m.data_source == "live" else "a demo scenario, not today's data"
    lines = [f"{MODULE_NAMES.get(m.id, m.title)}: {LEVEL_WORDS[m.level]} (from {origin}"]
    lines[0] += f"; confidence {m.confidence})" if m.confidence else ")"
    if m.status:
        lines.append(f"  State: {m.status}")
    lines.append(f"  In short: {m.headline}")
    lines.append(f"  Why: {m.explanation}")
    if m.action and m.action.kind != "none":
        lines.append(f"  Do now: {m.action.title}. {m.action.detail}")
    trend = "rising" if m.change_7d >= 8 else "easing" if m.change_7d <= -8 else "steady"
    lines.append(f"  Compared with a week ago: {trend}")
    for f in sorted(m.factors, key=lambda f: f.score * f.weight, reverse=True):
        lines.append(f"  - {f.label} ({influence(f.score)} influence): {f.detail}")
    ind = m.indicators
    if ind:
        if ind.last_clear_view is None:
            lines.append("  Satellites have not had a clear view of the field yet.")
        elif ind.greenness is not None and ind.greenness < 0.1:
            lines.append(f"  The last clear satellite view ({ind.last_clear_view:%d %B}) showed water, not crop, on the field.")
        elif ind.greenness is not None and ind.greenness_normal:
            pct = round(100 * ind.greenness / ind.greenness_normal)
            lines.append(f"  Plant greenness was {pct}% of normal for the season on {ind.last_clear_view:%d %B}.")
        if ind.cloud_gap_days is not None and ind.cloud_gap_days > 45:
            lines.append(f"  Clouds have hidden the field for {ind.cloud_gap_days} days; walking the field matters most.")
        lines.append(f"  Hot days above the {ind.crop} limit of {ind.heat_limit_c:.0f}°C: {ind.heat_days} of 10 (last week and next 3 days)")
        lines.append(f"  Days with weather that suits {ind.disease}: {ind.disease_days} of 8")
    return lines


def fact_sheet(d: Dashboard, today: date, lang: str) -> str:
    farm = d.farm
    language = "Bengali (বাংলা)" if lang == "bn" else "English"
    lines = [
        "FARM FACTS",
        f"Farmer's chosen language: {language}",
        f"Today: {today:%A %d %B %Y} (Bangladesh)",
        f"Farm: {farm.name}, {farm.district} district, {farm.division} division. Crop: {farm.crop}. Size: {farm.area_acres:g} acres.",
        f"About the place: {farm.story}",
        "",
        f"Overall today: {LEVEL_WORDS[d.overall.level]}. {d.overall.summary}",
        "",
    ]
    for m in d.modules:
        lines += _module_lines(m)
        lines.append("")
    lines.append("Weather forecast:")
    for f in d.forecast:
        lines.append(
            f"  - {f.date:%a %d %b}: {CONDITION_WORDS[f.condition]}, {f.rain_mm:.0f} mm rain, "
            f"high {f.temp_max_c:.0f}°C, low {f.temp_min_c:.0f}°C"
        )
    lines.append(f"  Rain expected in the next 3 days: about {rain_total(d.forecast, today, 3):.0f} mm")
    lines.append("")
    lines.append("Recommended actions, most important first:")
    for r in d.recommendations:
        lines.append(f"  - [{r.priority}] {r.title}: {r.reason} (when: {r.due})")
    return "\n".join(lines)
