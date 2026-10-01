"""Crops a farmer can choose when adding a farm.

`name` is the English crop name stored on the farm (the crop engine matches its risk
profile from it, e.g. "Aman rice" → rice); `scene` is the drawing the field view uses.
"""

from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class Crop:
    id: str
    name: str
    name_bn: str
    season: str
    season_bn: str
    scene: Literal["rice", "wheat", "potato"]


CROPS: list[Crop] = [
    Crop("boro-rice", "Boro rice", "বোরো ধান", "Dry season (Dec–May)", "শুষ্ক মৌসুম (ডিসেম্বর–মে)", "rice"),
    Crop("aman-rice", "Aman rice", "আমন ধান", "Monsoon (Jul–Nov)", "বর্ষা (জুলাই–নভেম্বর)", "rice"),
    Crop("aus-rice", "Aus rice", "আউশ ধান", "Early monsoon (Apr–Aug)", "আগাম বর্ষা (এপ্রিল–আগস্ট)", "rice"),
    Crop("wheat", "Wheat", "গম", "Winter (Nov–Mar)", "শীত (নভেম্বর–মার্চ)", "wheat"),
    Crop("maize", "Maize", "ভুট্টা", "Winter or summer", "শীত বা গ্রীষ্ম", "wheat"),
    Crop("potato", "Potato", "আলু", "Winter (Nov–Mar)", "শীত (নভেম্বর–মার্চ)", "potato"),
    Crop("jute", "Jute", "পাট", "Summer (Mar–Aug)", "গ্রীষ্ম (মার্চ–আগস্ট)", "wheat"),
    Crop("mustard", "Mustard", "সরিষা", "Winter (Nov–Feb)", "শীত (নভেম্বর–ফেব্রুয়ারি)", "wheat"),
    Crop("lentil", "Lentil", "মসুর ডাল", "Winter (Nov–Mar)", "শীত (নভেম্বর–মার্চ)", "potato"),
    Crop("tomato", "Tomato", "টমেটো", "Winter (Oct–Mar)", "শীত (অক্টোবর–মার্চ)", "potato"),
]

CROPS_BY_ID = {c.id: c for c in CROPS}


# Outside Bangladesh, crops go by their plain names (season names like "Boro rice" and local
# sowing calendars don't travel). Each uses the same engine profile as at home.
_ANY = ("Your local season", "আপনার এলাকার মৌসুম")
WORLD_CROPS: list[Crop] = [
    Crop("rice", "Rice", "ধান", *_ANY, "rice"),
    Crop("wheat", "Wheat", "গম", *_ANY, "wheat"),
    Crop("maize", "Maize", "ভুট্টা", *_ANY, "wheat"),
    Crop("potato", "Potato", "আলু", *_ANY, "potato"),
    Crop("tomato", "Tomato", "টমেটো", *_ANY, "potato"),
    Crop("lentil", "Lentil", "মসুর ডাল", *_ANY, "potato"),
    Crop("mustard", "Mustard", "সরিষা", *_ANY, "wheat"),
    Crop("jute", "Jute", "পাট", *_ANY, "wheat"),
]
WORLD_CROPS_BY_ID = {c.id: c for c in WORLD_CROPS}
