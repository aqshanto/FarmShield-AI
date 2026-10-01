# FarmShield AI: Demo & Presentation Guide

A 5-minute walkthrough for the NASA Space Apps judging, plus a checklist and answers to
likely questions.

Live site: **https://farm-shield-ai-pi.vercel.app** · API: https://farmshield-api.onrender.com

## Before you present

| When | Check |
|---|---|
| Choose the mode | **Live site or `npm run dev`** shows today's real NASA data and everything, including the world segment. **`npm run demo`** shows the bundled Bangladesh scenario (a haor flood danger and a Barind drought): dramatic and repeatable, but farms outside Bangladesh and spot checks on the world map need live data, so skip the world segment there. |
| The day before | Click through every page once in the mode you'll use. For a local run, first `npm run setup`. |
| 15 minutes before | Run **`npm run warm -- --awake`** and leave that terminal open. It wakes the API (Render's free plan sleeps after about 15 idle minutes and takes 30–60 s to wake), opens everything the demo shows in English and Bengali, then keeps the server awake. For a local run: `npm run warm -- --local`. Every line should show ✓. |
| AI answers | Optional: put `ANTHROPIC_API_KEY` in `backend/.env` (or on Render) for Claude-written answers. Without it the built-in helper answers common questions in both languages. |
| Browser | Chrome or Edge, full screen (F11). Allow the microphone and location once beforehand. Edge usually offers online Bengali voices for read-aloud; Chrome on Windows often has none. |
| Backup | Keep a second tab open on `/dashboard`. Pages retry on their own if the backend is slow to answer. |

## The 5-minute script

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Home | Let the hero animate in | "Farmers lose crops to floods, dry spells and disease, often with little warning. FarmShield gives every farm satellite eyes." |
| 0:20 | Home → How it works | Scroll slowly; the line draws itself | "Four NASA missions measure rain, soil water and crop greenness. We compare today with what is normal and turn it into one clear answer, in the farmer's language." |
| 0:50 | Dashboard (Haor) | Overall ring, then **My field today**: press **Play last 2 weeks** | "This is the farmer's own field, drawn from the data. Watch the water rise as the flood risk grows. No numbers needed." |
| 1:20 | Dashboard | Switch to **বাংলা** in the header, then click the **Flood risk** card | "One tap and every page, number and date is in Bengali. Every risk shows its reasons, each from a named NASA source." |
| 1:50 | Map | Switch layers Flood → Water → Crop, click a farm | "The same engines score all of Bangladesh, about 300 land cells of 20 km, with no sensors in the field." |
| 2:20 | Map → world | **Whole world**, turn on **Soil moisture**, then **Rainfall**; tap East Africa | "And it isn't only Bangladesh. These are NASA's own global layers. Tap any spot on Earth, and FarmShield checks flood, water and crop risk there in seconds." |
| 3:00 | Add my farm | Search **Giza**, pick the first result, choose **Wheat**, save | "A farmer anywhere can add their field." On the dashboard: "On the edge of the desert, water stress is the danger here." Open **Flood risk**: "Away from Bangladesh we tune the checks to the land: the reasons say how high this field sits above the lowest ground nearby, not above the sea." |
| 3:40 | Assistant | Switch to **বাংলা**, tap "এই সপ্তাহে কি বন্যার ভয় আছে?", then ask by microphone | "Farmers can simply ask by voice, in their own language. Answers come only from the farm's facts, with no made-up numbers." |
| 4:20 | Data | Mission cards and the pipeline flow | "Everything is open NASA data: SMAP, GPM IMERG, MODIS, VIIRS, POWER and SRTM, refreshed automatically." |
| 4:45 | Home | Closing section | "Warnings that arrive before the water does, for any farm on Earth." |

**In demo mode** (`npm run demo`), skip 2:20 and 3:00. Instead add a Bangladeshi farm at
2:20 (choose a division and district, pick a crop, save) and spend the extra time on the
assistant.

## Likely questions

**Which NASA data do you use?** SMAP (soil moisture), GPM IMERG (rainfall), MODIS (NDVI
greenness), VIIRS (the seasonal greenness normal), NASA POWER (rain, soil wetness,
temperature, humidity and the climate normal), SRTM (land height) and GIBS (map imagery and
the global layers). The non-NASA inputs are the weather forecast (Open-Meteo, with MET Norway
as backup) and place names (OpenStreetMap).

**How are the risks calculated?** With explainable, weighted scorecards rather than a
black box. Each risk lists its reasons (for example "heavy rain on the way", "ground
already full", "low-lying field") with the NASA source behind each one, and a confidence
level. Missing data lowers the confidence instead of breaking the answer.

**Does it work outside Bangladesh? How do you adapt it?** Yes, anywhere between 60°S and
75°N. Bangladesh keeps the calibration the engines were built on. Elsewhere three things
adapt from NASA data: flood terrain uses how high the field sits above the lowest land within
about 2 km (SRTM), not height above sea level; the soil's water-holding capacity is estimated
by comparing SMAP's moisture with NASA POWER's wetness index; and "today" is the farm's own
local day. Crops go by plain names with the same disease and heat rules.

**Why not machine learning?** There is no labelled field-loss data for these farms yet,
and farmers and extension officers need to see why a warning was raised. The scorecards
are transparent and tested; calibrating them against reported losses is the next step.

**Has it been validated?** Not against past disasters yet. The engines are unit-tested
and checked against today's real data. Planned: backtests on the 2022 Sylhet floods and
the 2016 wheat blast outbreak.

**What if a data service goes down?** Every outside service has a fallback. When the
forecast service refused our server, the forecast switched to MET Norway and the map's
weather to NASA POWER; place names are optional; the map serves its last good version.
The dashboards say plainly when something is missing.

**What about farmers without smartphones or internet?** The assistant works without the
AI model, and the advice is short enough for SMS or voice calls, which is the natural next
channel.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The first page takes a minute | Render was asleep. Run `npm run warm` (or `-- --awake` to keep it up) before presenting. |
| Map legend says "Getting live data…" | The server just started and is building today's map; it swaps in by itself within a minute. |
| Place search takes a few seconds | The first search for a name asks OpenStreetMap; the same search later is instant. `npm run warm` pre-loads "Giza" and "Kiambu". |
| A new farm says "Still downloading NASA data" | Its first NASA download is running; the page retries by itself. |
| Farm cards missing on Home | The backend is still starting. Pages retry automatically; reload if it takes more than 15 s. |
| Data page says GPM "needs approval" | Approve the GES DISC app in your Earthdata profile (link on the page). NASA POWER rainfall stands in meanwhile. |
| Map has no imagery | The basemap and NASA world layers need internet. The risk layers still draw. |
| "Listen" is greyed out | The device has no voice for that language. Use Edge, or install a voice in the OS speech settings. |
| Everything is calm on stage | Switch to `npm run demo` for the dramatic scenario (and skip the world segment). |
