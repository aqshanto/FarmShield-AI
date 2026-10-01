"""Built-in farmer assistant: answers common questions straight from the risk engines.

Runs when no Anthropic API key is set (or Claude can't be reached), so a farmer always gets
an answer. It recognises a handful of topics in English and Bengali, and builds replies from
the dashboard: English reuses the engines' own plain-language text, Bengali uses templates
keyed on the same levels and actions (never machine-translated free text).
"""

import re
from datetime import date

from app.assistant.facts import rain_total
from app.schemas.dashboard import Dashboard, DayForecast, RiskModuleSummary

BENGALI = re.compile(r"[ঀ-৿]")
BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

# Topic keywords. Bengali stems match inflected forms (বন্যা, বন্যার, বন্যায়).
TOPICS: dict[str, list[str]] = {
    "greeting": [r"^\s*(hi|hello|hey|salam|assalam|good (morning|evening|afternoon))\b", r"^\s*(হ্যালো|হাই|আসসালাম|সালাম|নমস্কার|শুভ)"],
    "thanks": [r"\b(thank|thanks|thx)\b", r"ধন্যবাদ|শুকরিয়া"],
    "flood": [r"flood|water ?logg|drown|under water|rising water|overflow", r"বন্যা|ঢল|ডুবে|ডুব|পানি উঠ|জলাবদ্ধ|পানি জম"],
    "water": [r"irrigat|water (my|the|it)|should i water|dry|drought|soil|thirst", r"সেচ|পানি দে|পানি দি|শুকন|শুকিয়ে|খরা|মাটি"],
    "crop": [r"crop|plant|leaf|leaves|disease|blight|blast|pest|insect|healthy|sick|yellow|green", r"ফসল|গাছ|পাতা|রোগ|পোকা|সুস্থ|হলুদ|সবুজ|ধান|গম|আলু|ব্লাস্ট|ধসা"],
    "weather": [r"rain|weather|forecast|hot|heat|temperature|storm|cloud|sun", r"বৃষ্টি|আবহাওয়া|গরম|তাপ|ঝড়|মেঘ|রোদ"],
    "today": [r"today|what (should|can|do) i do|advice|suggest|summary|overall|how is my farm|status", r"আজ|কী করব|কি করব|কী করা|কি করা|পরামর্শ|অবস্থা|সারাংশ|কেমন আছে"],
}

LEVEL_BN = {"safe": "নিরাপদ", "watch": "নজরে রাখুন", "warning": "সতর্কতা", "danger": "বিপদ"}
MODULE_BN = {"flood_risk": "বন্যা", "water_stress": "পানি", "crop_health": "ফসল"}
MODULE_EN = {"flood_risk": "Flood", "water_stress": "Water", "crop_health": "Crop"}
CROP_BN = {"boro rice": "বোরো ধান", "rice": "ধান", "wheat": "গম", "potato": "আলু"}
DISEASE_BN = {
    "blast": "ব্লাস্ট রোগ",
    "wheat blast": "গমের ব্লাস্ট রোগ",
    "late blight": "নাবি ধসা (লেট ব্লাইট) রোগ",
}
DISTRICT_BN = {"Sunamganj": "সুনামগঞ্জ", "Rajshahi": "রাজশাহী", "Bogura": "বগুড়া"}
WEEKDAY_BN = ["সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার", "রবিবার"]


def detect_lang(text: str, fallback: str) -> str:
    """Bengali script always gets a Bengali reply; otherwise use the farmer's chosen language."""
    return "bn" if BENGALI.search(text) else fallback


def topics_in(text: str) -> list[str]:
    lowered = text.lower()
    return [topic for topic, patterns in TOPICS.items() if any(re.search(p, lowered) for p in patterns)]


def bn_num(value: float) -> str:
    return f"{value:.0f}".translate(BN_DIGITS)


BN_VOWEL_ENDINGS = set("ািীুূৃেৈোৌঅআইঈউঊঋএঐওঔ")


def bn_of(word: str) -> str:
    """Bengali possessive: আলু → আলুর, বগুড়া → বগুড়ার, ধান → ধানের."""
    return f"{word}র" if word[-1] in BN_VOWEL_ENDINGS else f"{word}ের"


def _crop_bn(crop: str) -> str:
    return CROP_BN.get(crop.lower(), crop)


def _module(d: Dashboard, module_id: str) -> RiskModuleSummary | None:
    return next((m for m in d.modules if m.id == module_id), None)


def _top_factor(m: RiskModuleSummary):
    ranked = sorted(m.factors, key=lambda f: f.score * f.weight, reverse=True)
    return ranked[0] if ranked and ranked[0].score >= 40 else None


def _rain_bn(forecast: list[DayForecast], today: date) -> str:
    mm = rain_total(forecast, today, 3)
    if mm < 5:
        return "আগামী ৩ দিনে তেমন বৃষ্টি নেই।"
    size = "হালকা" if mm < 30 else "মাঝারি" if mm < 80 else "ভারী"
    return f"আগামী ৩ দিনে {size} বৃষ্টি হতে পারে (প্রায় {bn_num(mm)} মিমি)।"


def _rain_en(forecast: list[DayForecast], today: date) -> str:
    mm = rain_total(forecast, today, 3)
    if mm < 5:
        return "Little rain is expected in the next 3 days."
    size = "Light" if mm < 30 else "Moderate" if mm < 80 else "Heavy"
    return f"{size} rain is expected in the next 3 days (about {mm:.0f} mm)."


def _first_advice(d: Dashboard, module_id: str) -> str:
    rec = next((r for r in d.recommendations if r.module == module_id), None)
    return f"{rec.title}. {rec.reason}" if rec else ""


# --- topic answers ----------------------------------------------------------------------


def flood_answer(d: Dashboard, today: date, lang: str) -> str:
    m = _module(d, "flood_risk")
    if m is None:
        return "বন্যার তথ্য এখন পাওয়া যাচ্ছে না।" if lang == "bn" else "I don't have flood information right now."
    if lang == "bn":
        rain = _rain_bn(d.forecast, today)
        return {
            "safe": f"এই সপ্তাহে বন্যার ঝুঁকি কম। {rain} তবুও নালা পরিষ্কার রাখুন, যাতে হঠাৎ ভারী বৃষ্টির পানি দ্রুত নেমে যায়।",
            "watch": f"বন্যার ঝুঁকি একটু বাড়ছে, নজর রাখুন। {rain} নালা পরিষ্কার করুন এবং নিচু জমি থেকে পানি বের হওয়ার পথ খোলা রাখুন।",
            "warning": f"সতর্ক থাকুন: আগামী কয়েক দিনে জমিতে পানি উঠতে পারে। {rain} নালা খুলে দিন, আর বীজ ও সার উঁচু জায়গায় সরিয়ে রাখুন।",
            "danger": f"বিপদ: বন্যার ঝুঁকি খুব বেশি। {rain} পাকা ফসল থাকলে এখনই কেটে ফেলুন। বীজ, সার আর গবাদিপশু উঁচু জায়গায় সরিয়ে নিন।",
        }[m.level]
    advice = _first_advice(d, "flood_risk")
    return " ".join(p for p in [m.headline, m.explanation, advice] if p)


def water_answer(d: Dashboard, today: date, lang: str) -> str:
    m = _module(d, "water_stress")
    if m is None:
        return "মাটির পানির তথ্য এখন পাওয়া যাচ্ছে না।" if lang == "bn" else "I don't have soil water information right now."
    kind = m.action.kind if m.action else "none"
    if lang == "bn":
        if kind == "irrigate":
            return "হ্যাঁ, আজই সেচ দিন। মাটি শুকিয়ে যাচ্ছে আর সামনে ভালো বৃষ্টি নেই। ভোরে বা বিকেলে সেচ দিন, তাতে রোদে কম পানি নষ্ট হয়।"
        if kind == "hold":
            return "এখন সেচ দেওয়ার দরকার নেই। মাটিতে যথেষ্ট পানি আছে বা বৃষ্টি আসছে। এতে পানি আর খরচ দুটোই বাঁচবে।"
        if kind == "check":
            return "আজ সেচ লাগবে না, তবে মাটি শুকাচ্ছে। ২-৩ দিন পর মাটিতে আঙুল ৫ সেমি ঢুকিয়ে দেখুন; শুকনো লাগলে সেচ দিন।"
        return {
            "safe": "মাটিতে পানি ঠিক আছে। এখন সেচের দরকার নেই।",
            "watch": "মাটি শুকাতে শুরু করেছে। পরের সেচের পরিকল্পনা করে রাখুন।",
            "warning": "মাটি বেশ শুকনো। শিগগিরই সেচ দিন।",
            "danger": "মাটি খুব শুকনো, ফসল পানির কষ্টে আছে। আজই সেচ দিন।",
        }[m.level]
    parts = [m.headline]
    if m.action and m.action.kind != "none":
        parts.append(f"{m.action.title}. {m.action.detail}")
    else:
        parts.append(m.explanation)
    return " ".join(parts)


def crop_answer(d: Dashboard, today: date, lang: str) -> str:
    m = _module(d, "crop_health")
    if m is None:
        return "ফসলের তথ্য এখন পাওয়া যাচ্ছে না।" if lang == "bn" else "I don't have crop information right now."
    top = _top_factor(m)
    ind = m.indicators
    cloudy = ind is not None and ind.cloud_gap_days is not None and ind.cloud_gap_days > 45
    if lang == "bn":
        crop = _crop_bn(d.farm.crop)
        disease = DISEASE_BN.get(ind.disease, "ছত্রাকজনিত রোগ") if ind else "রোগ"
        parts = [{
            "safe": f"আপনার {crop} ভালো আছে।",
            "watch": f"আপনার {crop} মোটামুটি ভালো, তবে কয়েকটি বিষয়ে নজর রাখুন।",
            "warning": f"আপনার {crop} চাপে আছে, এখনই যত্ন নিন।",
            "danger": f"আপনার {crop} বড় বিপদে আছে, আজই ব্যবস্থা নিন।",
        }[m.level]]
        reason = {
            "heat": f"গরম বেশি: দিনের তাপমাত্রা {bn_of(crop)} সহ্যের সীমা ছাড়িয়ে যাচ্ছে। গরমের দিনে বিকেলে পানি দিন, জমি ঠান্ডা থাকবে।",
            "disease": f"আবহাওয়া ভেজা আর গরম, তাই {disease} ছড়াতে পারে। প্রতিদিন পাতায় দাগ আছে কি না দেখুন।",
            "water": "জমিতে পানির ঘাটতি হচ্ছে, সেচের দিকে খেয়াল রাখুন।",
            "flood": "জমিতে পানি জমে থাকার ঝুঁকি আছে, নালা খুলে দিন।",
            "greenness": "উপগ্রহের ছবিতে গাছ স্বাভাবিকের চেয়ে কম সবুজ দেখা যাচ্ছে। জমি ঘুরে দেখুন।",
            "trend": "উপগ্রহের ছবিতে গাছের সবুজ ভাব কমছে। জমি ঘুরে দেখুন।",
        }.get(top.id) if top else None
        if reason:
            parts.append(reason)
        if cloudy:
            parts.append("মেঘের কারণে অনেক দিন উপগ্রহ আপনার জমি দেখতে পায়নি, তাই নিজে একবার জমি ঘুরে দেখুন।")
        return " ".join(parts)
    parts = [m.headline, m.explanation]
    advice = _first_advice(d, "crop_health")
    if advice:
        parts.append(advice)
    return " ".join(parts)


def weather_answer(d: Dashboard, today: date, lang: str) -> str:
    days = [f for f in d.forecast if f.date >= today][:7]
    if not days:
        return "আবহাওয়ার পূর্বাভাস এখন নেই।" if lang == "bn" else "I don't have a forecast right now."
    total = sum(f.rain_mm for f in days)
    wet = sum(1 for f in days if f.rain_mm >= 1)
    hottest = max(days, key=lambda f: f.temp_max_c)
    storms = [f for f in days if f.condition == "storm"]
    if lang == "bn":
        rain = (
            f"আগামী {bn_num(len(days))} দিনে মোট প্রায় {bn_num(total)} মিমি বৃষ্টি হতে পারে; {bn_num(wet)} দিন বৃষ্টির সম্ভাবনা।"
            if wet
            else f"আগামী {bn_num(len(days))} দিনে তেমন বৃষ্টি নেই (মোট প্রায় {bn_num(total)} মিমি)।"
        )
        parts = [
            rain,
            f"সবচেয়ে গরম দিন {WEEKDAY_BN[hottest.date.weekday()]}, প্রায় {bn_num(hottest.temp_max_c)}° সেলসিয়াস।",
        ]
        if storms:
            parts.append(f"ঝড়ের সম্ভাবনা আছে {WEEKDAY_BN[storms[0].date.weekday()]}। খোলা জায়গায় কাজ এড়িয়ে চলুন।")
        return " ".join(parts)
    parts = [
        f"Over the next {len(days)} days, about {total:.0f} mm of rain is expected, with rain on {wet} day{'s' if wet != 1 else ''}."
        if wet
        else f"Little or no rain is expected over the next {len(days)} days (about {total:.0f} mm in total).",
        f"The hottest day is {hottest.date:%A}, around {hottest.temp_max_c:.0f}°C.",
    ]
    if storms:
        parts.append(f"A storm is possible on {storms[0].date:%A}. Avoid working in open fields then.")
    return " ".join(parts)


def today_answer(d: Dashboard, today: date, lang: str) -> str:
    worst = max(d.modules, key=lambda m: m.score)
    if lang == "bn":
        opener = {
            "safe": "আজ আপনার খামারের অবস্থা ভালো।",
            "watch": "আজ কয়েকটি বিষয়ে নজর রাখুন।",
            "warning": "এখনই প্রস্তুতি নিন।",
            "danger": "জরুরি: এখনই ব্যবস্থা নিন।",
        }[d.overall.level]
        lines = [opener] + [f"• {MODULE_BN[m.id]}: {LEVEL_BN[m.level]}" for m in d.modules]
        first = ANSWERS[{"flood_risk": "flood", "water_stress": "water", "crop_health": "crop"}[worst.id]](d, today, "bn")
        lines.append(f"সবচেয়ে জরুরি: {first}")
        return "\n".join(lines)
    lines = [d.overall.summary] + [f"• {MODULE_EN[m.id]}: {m.headline}" for m in d.modules]
    if d.recommendations:
        top = d.recommendations[0]
        lines.append(f"First job: {top.title}. {top.reason}")
    return "\n".join(lines)


ANSWERS = {"flood": flood_answer, "water": water_answer, "crop": crop_answer, "weather": weather_answer, "today": today_answer}


def reply(d: Dashboard, question: str, today: date, lang: str) -> str:
    lang = detect_lang(question, lang)
    found = topics_in(question)
    district = DISTRICT_BN.get(d.farm.district, d.farm.district) if lang == "bn" else d.farm.district

    # A specific topic beats the general "today" summary ("Should I irrigate today?" is about water).
    specific = [t for t in found if t in ("flood", "water", "crop", "weather")][:2]
    if specific:
        return "\n\n".join(ANSWERS[t](d, today, lang) for t in specific)
    if "today" in found:
        return today_answer(d, today, lang)
    if "thanks" in found:
        return "আপনাকেও ধন্যবাদ! আর কিছু জানতে চাইলে জিজ্ঞেস করুন। ভালো ফসল হোক!" if lang == "bn" else "You're welcome! Ask me anything else about your field. Wishing you a good harvest!"
    if "greeting" in found:
        if lang == "bn":
            return f"আসসালামু আলাইকুম! আমি ফার্মশিল্ড, আপনার খামারের সাহায্যকারী। {bn_of(district)} জমি নিয়ে যেকোনো প্রশ্ন করুন: সেচ, বন্যা, ফসলের রোগ বা আবহাওয়া।"
        return f"Hello! I'm FarmShield, your farm helper. Ask me anything about your field in {district}: irrigation, floods, crop health or the weather."
    # Didn't recognise the question: say so, then give the day's picture.
    if lang == "bn":
        return (
            "দুঃখিত, প্রশ্নটা ঠিক বুঝতে পারিনি। আমি সেচ, বন্যা, ফসলের স্বাস্থ্য আর আবহাওয়া নিয়ে বলতে পারি। "
            "অন্য বিষয়ে স্থানীয় কৃষি অফিস বা কৃষি কল সেন্টারে (১৬১২৩) ফোন করুন।\n\n" + today_answer(d, today, "bn")
        )
    return (
        "Sorry, I didn't quite catch that. I can help with irrigation, floods, crop health and the weather. "
        "For other questions, call your local agriculture office or the Krishi Call Centre (16123).\n\n" + today_answer(d, today, "en")
    )
