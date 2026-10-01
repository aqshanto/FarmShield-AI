"""Farmer-facing text in English or Bengali.

The engines write English; `translate()` turns any of their sentences into Bengali using
the template catalog in `bn.py`, converting numbers, dates, crops and diseases too.
Unknown sentences stay in English and are recorded in MISSES (the coverage test fails on
them, so new engine wording can't ship untranslated).
"""

import logging
import re
from functools import lru_cache
from typing import Literal

from app.i18n import bn

Lang = Literal["en", "bn"]
log = logging.getLogger(__name__)
MISSES: set[str] = set()

_ALT = lambda words: "|".join(re.escape(w) for w in sorted(words, key=len, reverse=True))  # noqa: E731
SLOT_PATTERNS = {
    "n": r"\d+(?:\.\d+)?",
    "crop": _ALT(bn.CROPS),
    "disease": _ALT(bn.DISEASES),
    "level": _ALT(bn.LEVELS),
    "module": _ALT(bn.MODULES),
    "weekday": _ALT(bn.WEEKDAYS),
    "month": _ALT(m for m in bn.MONTHS if len(m) > 3),
    "date": rf"\d{{1,2}} (?:{_ALT(bn.MONTHS)})",
}
SLOT = re.compile(r"\{([a-z]+)(\d*)\}")
SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9])")
BN_VOWEL_ENDINGS = set("ািীুূৃেৈোৌঅআইঈউঊঋএঐওঔ")


def bn_digits(text: str) -> str:
    return text.translate(bn.DIGITS)


def bn_of(word: str) -> str:
    """Bengali possessive: ধান → ধানের, আলু → আলুর, রোগ → রোগের."""
    return f"{word}র" if word and word[-1] in BN_VOWEL_ENDINGS else f"{word}ের"


def _compile(template: str) -> re.Pattern[str]:
    parts, last = [], 0
    for m in SLOT.finditer(template):
        parts.append(re.escape(template[last : m.start()]))
        parts.append(f"(?P<{m[1]}{m[2]}>{SLOT_PATTERNS[m[1]]})")
        last = m.end()
    parts.append(re.escape(template[last:]))
    return re.compile("^" + "".join(parts) + "$")


@lru_cache
def _catalog() -> tuple[dict[str, str], list[tuple[re.Pattern[str], str]]]:
    exact, patterns = {}, []
    for en, bengali in bn.CATALOG:
        if SLOT.search(en):
            patterns.append((_compile(en), bengali))
        else:
            exact[en] = bengali
    # Most specific (longest) templates first.
    patterns.sort(key=lambda p: len(p[0].pattern), reverse=True)
    return exact, patterns


def _slot_values(groups: dict[str, str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for name, value in groups.items():
        base = name.rstrip("0123456789")
        if base == "n":
            values[name] = bn_digits(value)
        elif base == "date":
            day, month = value.split(" ", 1)
            values[name] = f"{bn_digits(str(int(day)))} {bn.MONTHS[month]}"
        else:
            table = {"crop": bn.CROPS, "disease": bn.DISEASES, "level": bn.LEVELS, "module": bn.MODULES, "weekday": bn.WEEKDAYS, "month": bn.MONTHS}[base]
            values[name] = table[value]
            values[f"{name}_of"] = bn_of(table[value])
    return values


def _sentence(sentence: str) -> str | None:
    exact, patterns = _catalog()
    if sentence in exact:
        return exact[sentence]
    for pattern, bengali in patterns:
        if m := pattern.match(sentence):
            return bengali.format(**_slot_values(m.groupdict()))
    return None


def translate(text: str | None, lang: str) -> str | None:
    """English engine text → the farmer's language. Unknown sentences stay in English."""
    if lang != "bn" or not text:
        return text
    out = []
    for piece in SENTENCE_BREAK.split(text.strip()):
        stop = piece.endswith((".", "!", "?"))
        core = piece.rstrip(".!?") if stop else piece
        bengali = _sentence(core)
        if bengali is None:
            MISSES.add(core)
            log.debug("No Bengali for: %s", core)
            out.append(piece)
        else:
            out.append(bengali + ("।" if stop else ""))
    return " ".join(out)
