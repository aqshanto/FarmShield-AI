"""The text message a farmer on a basic phone would get today, built from the dashboard.

Only a warning or danger sends a message (the same overall level the dashboard shows), so a
text always means "act now" and farmers don't learn to ignore it. The message is the overall
summary plus the most urgent advice for the risk behind it, in the farmer's language.

Phone networks count SMS characters in one of two alphabets. Plain English fits the GSM
alphabet: 160 characters in one SMS, 153 per part when split. Bengali (or any symbol outside
GSM) needs Unicode: only 70 characters in one SMS, 67 per part.
"""

from math import ceil

from app.schemas.dashboard import Dashboard, SmsPreview

SENDS_ON = ("warning", "danger")
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

# The GSM 03.38 basic alphabet; the extension characters each take two slots.
GSM_BASIC = set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?"
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
)
GSM_EXTENSION = set("^{}\\[~]|€")
# Typography that would force Unicode (and cut an SMS from 160 to 70 characters) for nothing.
PLAIN = str.maketrans({"–": "-", "—": "-", "’": "'", "‘": "'", "“": '"', "”": '"', "…": "..."})


def sms_length(text: str) -> tuple[int, bool]:
    """Characters as the network counts them, and whether the message needs Unicode."""
    if all(c in GSM_BASIC or c in GSM_EXTENSION for c in text):
        return sum(2 if c in GSM_EXTENSION else 1 for c in text), False
    return len(text.encode("utf-16-le")) // 2, True


def sms_parts(text: str) -> tuple[int, int, int]:
    """(characters, SMS parts, characters that fit in one SMS)."""
    length, unicode = sms_length(text)
    single, part = (70, 67) if unicode else (160, 153)
    return length, (1 if length <= single else ceil(length / part)), single


def _sentence(text: str, lang: str) -> str:
    end = "।" if lang == "bn" else "."
    return text if text.endswith(("।", ".", "!", "?")) else text + end


def sms_preview(d: Dashboard, lang: str) -> SmsPreview:
    """`d` must already be in `lang` (see localize_dashboard)."""
    if d.overall.level not in SENDS_ON:
        return SmsPreview(lang=lang, send=False)

    worst = max(d.modules, key=lambda m: m.score).id if d.modules else None
    advice = sorted(d.recommendations, key=lambda r: (r.module != worst, PRIORITY_ORDER.get(r.priority, 3)))
    summary = d.overall.summary.translate(PLAIN)
    action = _sentence(advice[0].title, lang).translate(PLAIN) if advice else ""

    # With the field's name on its own line if that still fits in one SMS (a farmer may have
    # several fields).
    full = f"{d.farm.name.translate(PLAIN)}\n{summary} {action}".strip()
    short = f"{summary} {action}".strip()
    text = full if sms_parts(full)[1] == 1 else short
    length, parts, single = sms_parts(text)
    return SmsPreview(lang=lang, send=True, text=text, length=length, parts=parts, single_limit=single)
