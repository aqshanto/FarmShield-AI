"""Demo farms for DATA_MODE=sample.

Three Bangladeshi farms, each telling a different climate story. The shapes match what the
live NASA pipeline (Phase 4) and risk engines (Phase 5) will produce, so the frontend
doesn't change when real data arrives. Forecast entries are offsets from "today" and are
turned into real dates by the dashboard service.
"""

from typing import Any

SAMPLE_FARMS: dict[str, dict[str, Any]] = {
    "sunamganj-haor": {
        "farm": {
            "id": "sunamganj-haor",
            "name": "Haor Rice Field",
            "district": "Sunamganj",
            "division": "Sylhet",
            "crop": "Boro rice",
            "area_acres": 2.5,
            "lat": 25.03,
            "lon": 91.25,
            "story": "Low-lying wetland field. Flash floods from upstream hills can arrive within days.",
        },
        "hours_since_pass": 2,
        "modules": {
            "flood_risk": {
                "title": "Flood risk",
                "headline": "Flash flood likely in 2–3 days.",
                "explanation": "Heavy rain upstream and very wet soil mean water will rise fast in the haor. Low fields could go under water within 2–3 days.",
                "metrics": [("Rain next 3 days", 254, "mm", "GPM"), ("Soil wetness", 91, "%", "SMAP")],
                "trend": [22, 24, 23, 27, 30, 29, 34, 38, 45, 51, 58, 64, 71, 78],
                "sources": ["GPM", "SMAP"],
            },
            "water_stress": {
                "title": "Water stress",
                "headline": "Plenty of water in the soil.",
                "explanation": "Recent rain has filled the soil. No irrigation needed this week.",
                "metrics": [("Soil wetness", 91, "%", "SMAP"), ("Days since good rain", 1, "days", "GPM")],
                "trend": [18, 17, 16, 15, 15, 14, 14, 13, 13, 12, 12, 12, 12, 12],
                "sources": ["SMAP", "GPM"],
            },
            "crop_health": {
                "title": "Crop health",
                "headline": "Rice is ripening, but humid air invites disease.",
                "explanation": "The field is still green and healthy, but warm, wet days make blast disease more likely. Check leaves after the rain.",
                "metrics": [("Plant greenness", 64, "%", "MODIS"), ("Greenness change", -2, "% this week", "MODIS")],
                "trend": [22, 22, 23, 23, 24, 24, 25, 25, 26, 27, 28, 28, 29, 30],
                "sources": ["MODIS", "VIIRS"],
            },
        },
        "forecast": [
            ("cloudy", 12, 30, 24),
            ("rain", 38, 29, 24),
            ("storm", 96, 27, 23),
            ("storm", 120, 26, 23),
            ("rain", 54, 27, 23),
            ("rain", 22, 28, 24),
            ("partly_cloudy", 6, 30, 24),
        ],
        "recommendations": [
            ("r1", "flood_risk", "high", "Harvest ripe rice now", "Grain that is 80% ripe is safer in your store than in a flooded field.", "Today"),
            ("r2", "flood_risk", "high", "Clear drainage channels", "Open channels let water leave your field faster.", "Within 2 days"),
            ("r3", "flood_risk", "medium", "Move seed and fertilizer to high ground", "Keep next season's inputs safe and dry.", "Within 2 days"),
            ("r4", "crop_health", "low", "Check leaves for blast spots", "Brown, diamond-shaped spots spread fast in wet weather.", "After the rain"),
        ],
    },
    "barind-wheat": {
        "farm": {
            "id": "barind-wheat",
            "name": "Barind Wheat Farm",
            "district": "Rajshahi",
            "division": "Rajshahi",
            "crop": "Wheat",
            "area_acres": 4.0,
            "lat": 24.62,
            "lon": 88.56,
            "story": "High, red-soil Barind tract. Long dry spells and heat are the biggest threat.",
        },
        "hours_since_pass": 5,
        "modules": {
            "flood_risk": {
                "title": "Flood risk",
                "headline": "No flood risk.",
                "explanation": "Dry weather and hard soil. No flooding expected this week.",
                "metrics": [("Rain next 3 days", 0, "mm", "GPM"), ("Soil wetness", 14, "%", "SMAP")],
                "trend": [8, 7, 7, 6, 6, 6, 6, 5, 5, 6, 6, 6, 6, 6],
                "sources": ["GPM", "SMAP"],
            },
            "water_stress": {
                "title": "Water stress",
                "headline": "Soil is very dry. Irrigate today.",
                "explanation": "No good rain for 26 days and temperatures near 40°C. Your wheat is losing water faster than its roots can find it.",
                "metrics": [("Soil wetness", 14, "%", "SMAP"), ("Days since good rain", 26, "days", "GPM")],
                "trend": [52, 55, 57, 60, 62, 64, 67, 69, 71, 73, 75, 77, 79, 81],
                "sources": ["SMAP", "GPM", "MODIS"],
            },
            "crop_health": {
                "title": "Crop health",
                "headline": "Wheat is showing heat stress.",
                "explanation": "Plants look less green than last week. Leaves may curl or yellow at the tips in the afternoon heat.",
                "metrics": [("Plant greenness", 41, "%", "MODIS"), ("Greenness change", -9, "% this week", "MODIS")],
                "trend": [30, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55],
                "sources": ["MODIS", "VIIRS"],
            },
        },
        "forecast": [
            ("sunny", 0, 39, 27),
            ("sunny", 0, 40, 28),
            ("sunny", 0, 41, 28),
            ("partly_cloudy", 0, 40, 28),
            ("sunny", 0, 39, 27),
            ("partly_cloudy", 2, 38, 27),
            ("cloudy", 4, 36, 26),
        ],
        "recommendations": [
            ("r1", "water_stress", "high", "Irrigate early morning or evening", "Less water is lost to the heat when the sun is low.", "Today"),
            ("r2", "water_stress", "medium", "Cover the soil with straw mulch", "Mulch keeps moisture in the soil for days longer.", "This week"),
            ("r3", "crop_health", "medium", "Check for yellow, curling leaves", "Early heat stress shows first at the leaf tips.", "Within 2 days"),
            ("r4", "water_stress", "low", "Ask about heat-tolerant wheat", "Your local agriculture office can suggest a variety for next season.", "Next season"),
        ],
    },
    "bogura-potato": {
        "farm": {
            "id": "bogura-potato",
            "name": "Bogura Potato Field",
            "district": "Bogura",
            "division": "Rajshahi",
            "crop": "Potato",
            "area_acres": 1.5,
            "lat": 24.9,
            "lon": 89.35,
            "story": "Fertile river-plain field in the cool season. Conditions are good this week.",
        },
        "hours_since_pass": 3,
        "modules": {
            "flood_risk": {
                "title": "Flood risk",
                "headline": "Light rain in 4 days. No flood expected.",
                "explanation": "A small rain is coming. Low corners of the field may stay wet for a day.",
                "metrics": [("Rain next 7 days", 19, "mm", "GPM"), ("Soil wetness", 48, "%", "SMAP")],
                "trend": [15, 16, 18, 20, 22, 21, 20, 22, 23, 22, 21, 21, 20, 20],
                "sources": ["GPM", "SMAP"],
            },
            "water_stress": {
                "title": "Water stress",
                "headline": "Soil moisture is just right.",
                "explanation": "The soil has enough water for your potatoes. Next light irrigation in about 5 days.",
                "metrics": [("Soil wetness", 48, "%", "SMAP"), ("Days since good rain", 9, "days", "GPM")],
                "trend": [25, 24, 23, 22, 22, 21, 20, 20, 19, 19, 18, 18, 18, 18],
                "sources": ["SMAP", "GPM", "MODIS"],
            },
            "crop_health": {
                "title": "Crop health",
                "headline": "Your crop looks healthy.",
                "explanation": "Potato plants are green and growing well across the field.",
                "metrics": [("Plant greenness", 83, "%", "MODIS"), ("Greenness change", 2, "% this week", "MODIS")],
                "trend": [14, 13, 13, 12, 12, 12, 11, 11, 11, 10, 10, 10, 10, 10],
                "sources": ["MODIS", "VIIRS"],
            },
        },
        "forecast": [
            ("partly_cloudy", 0, 27, 15),
            ("sunny", 0, 28, 14),
            ("cloudy", 3, 26, 15),
            ("rain", 14, 24, 16),
            ("partly_cloudy", 2, 25, 14),
            ("sunny", 0, 27, 13),
            ("sunny", 0, 28, 14),
        ],
        "recommendations": [
            ("r1", "crop_health", "medium", "Watch for late blight on foggy mornings", "Dark, wet-looking patches on leaves spread fast in cool fog.", "This week"),
            ("r2", "flood_risk", "low", "Keep field edges drained", "Stops rainwater pooling in the low corners.", "Within 3 days"),
            ("r3", "water_stress", "low", "Light irrigation in 5 days", "Keep the soil moist, not soaked, while tubers grow.", "In 5 days"),
        ],
    },
}
