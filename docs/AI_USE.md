# Use of AI in FarmShield AI

The NASA Space Apps rules ask every team to name each AI tool it used, why, with which prompts,
and on what data. This is the full list for FarmShield AI.

**Only one AI tool was used: Claude by Anthropic.**

| Where | What Claude does | What stays the team's own work |
|---|---|---|
| 1. The app's farmer assistant | Writes the answer to a farmer's question | The NASA data, the risk ratings, the facts it may use and the rules it must follow |
| 2. Writing the code | Helped write and review the app's code and the video's editing code | The idea, the design, every decision, and testing on real fields |
| 3. The logo | Generated the FarmShield AI logo | Choosing and approving it |

Not made with AI: the risk ratings and rotation scores (fixed rules over NASA data, explained in
[ARCHITECTURE.md](ARCHITECTURE.md)), the video script, the narration (the real voice of team member
Tawhid Ahmed Saad), the screen recordings, and the team photos.

---

## 1. The farmer assistant (inside the app)

**Why:** a farmer should be able to ask about their own field in their own words, by voice or text, in
Bangla or English, and get a short, plain answer. Fixed text can't answer free questions.

**Model:** `claude-opus-5-5` through the Anthropic API, low effort (short answers, quick replies). Code:
[`backend/app/assistant/claude.py`](../backend/app/assistant/claude.py).

**The data it works on:** only a fact sheet that the app builds for that one field
([`backend/app/assistant/facts.py`](../backend/app/assistant/facts.py)). It is made from the field's NASA
data (SMAP soil moisture, GPM IMERG rain, MODIS/VIIRS greenness, NASA POWER climate, SRTM elevation),
the weather forecast, and the three ratings the app has already calculated (flood risk, water stress,
crop health) with their reasons and actions. Claude never sees raw satellite files, and it never
calculates a rating.

**The prompt (system prompt, in full):** the rules below are sent with every question, followed by
the field's fact sheet.

```text
You are FarmShield, a friendly farming helper for smallholder farmers, most of them in Bangladesh.
You talk with one farmer about their own field. FarmShield has already turned NASA satellite data
(rain, soil water, plant greenness, heat) into the plain-language farm facts that follow this message.

How to talk
- Sound like a kind, experienced neighbour who farms: warm, respectful, simple words, short sentences.
- Answer the question first in one or two sentences, then give at most three practical steps the
  farmer can take with what they have. Keep replies under about 120 words unless the farmer asks for more.
- Write plain text. A short list with "•" is fine; no headings, tables, markdown or emoji. Replies may
  be read aloud, so avoid symbols and abbreviations that sound odd when spoken.
- Never mention scientific indices, model names or jargon (NDVI, soil moisture fraction, anomaly,
  percentile, risk score out of 100). Say what they mean instead: "your plants look less green than
  usual", "the soil is drying out". Everyday numbers a farmer uses are fine: millimetres of rain, °C, days.

Language
- Reply in the farmer's chosen language from the farm facts. If the farmer writes in the other
  language, reply in the language they wrote in.
- For Bengali, use simple everyday Bangladeshi Bengali (চলিত ভাষা) with Bengali digits and common
  farming words such as সেচ, বন্যা, নালা, পোকা, রোগ.

Stay grounded
- The farm facts are your only source for this field's conditions and forecast. Don't invent rain
  amounts, dates, diseases or conditions that aren't there.
- When something is marked as coming from a demo scenario, say it is an example, not today's
  reading, if the farmer is deciding on it.
- If the facts don't cover a question, say so plainly and offer general good practice, clearly
  labelled as general advice.
- For pesticide or fertilizer doses, human or animal health, loans, or anything that could cause harm
  if wrong, give only general safe guidance and suggest the Upazila agriculture office or the free
  Krishi Call Centre on 16123.
- If a question has nothing to do with farming, weather or this field, answer briefly and kindly
  bring the talk back to the farm.
```

**Reasoning behind the prompt:**
- *Grounded in the fact sheet only*, so the answer can't invent a flood or a disease that NASA data
  doesn't show.
- *No jargon*, because the users are farmers, not scientists.
- *Short and read-aloud friendly*, because the answer can be spoken to the farmer.
- *Safe limits*: for doses, health or money, it points to the local agriculture office and the
  government's free Krishi Call Centre (16123) instead of guessing.

**Without AI:** if there is no API key or the call fails, the app answers from fixed templates
([`backend/app/assistant/offline.py`](../backend/app/assistant/offline.py)) built on the same facts.
The assistant works offline too; AI only makes the wording more natural.

## 2. Help writing the code

**Why:** a small team, one weekend. Claude (through Claude Code) helped us write, review and test
code faster.

**How we worked:** the team planned each feature and gave Claude one feature at a time, in the order
and with the rules written in [PROJECT_OVERVIEW.md](../PROJECT_OVERVIEW.md), [PLAN.md](../PLAN.md),
[AGENT.md](../AGENT.md) and [CLAUDE.md](../CLAUDE.md). The prompts we used for each feature are saved in
[DEVELOPMENT_PROMPTS.md](../DEVELOPMENT_PROMPTS.md) (for example "Prompt 05: NASA Data Integration",
"Prompt 09: AI Farmer Assistant"). After each feature the team checked the result in the browser and
in the tests before going on.

**Data:** our own code and the public NASA dataset documentation. No private data was shared.

**The team's own work:** the idea and the problem framing, which NASA datasets to use and how, the
rotation rules and risk thresholds, the Bangla wording, every design decision, and the final checks.

The video was edited the same way: the team wrote the script, recorded the narration and chose the
footage, and Claude wrote the code that cuts the clips, adds subtitles and mixes the sound.

## 3. The logo

**Why:** we needed a clear, simple logo quickly, so the team could spend its time on the app and the data.

**Tool:** Claude by Anthropic. The logo shows a shield (protection), a young plant (the farm) and a
satellite orbit (NASA data from space). The team chose it and approved it.
