# FarmShield AI: Demo & Presentation Guide

A 5-minute walkthrough for the NASA Space Apps judging, plus a checklist and answers to
likely questions.

Live site: **https://farm-shield-ai-pi.vercel.app** · API: https://farmshield-api-2.onrender.com

## Before you present

| When | Check |
|---|---|
| Choose the mode | Use the **live site or `npm run dev`**: it shows today's real NASA data and everything in this guide. **`npm run demo`** shows the bundled Bangladesh scenario (a haor flood danger and a Barind drought), which is dramatic and repeatable, but the rotation planner, farms outside Bangladesh and spot checks on the world map need live data. |
| The day before | Click through every page once in the mode you'll use. For a local run, first `npm run setup`. **Don't push code from now on:** each deploy empties Render's disk, and the NASA data has to download again. Until it has, farm pages say "Still downloading", and the planner has no groundwater and can miss haor land. |
| 15 minutes before | Run **`npm run warm -- --awake`** and leave that terminal open. It wakes the API (Render's free plan sleeps after about 15 idle minutes and takes 30–60 s to wake), opens everything the demo shows in English and Bengali, then keeps the server awake. For a local run: `npm run warm -- --local`. Every line should show ✓, including each farm's years of groundwater. |
| AI answers | Optional: put `ANTHROPIC_API_KEY` in `backend/.env` (or on Render) for Claude-written answers. Without it the built-in helper answers common questions in both languages. |
| Browser | Chrome or Edge, full screen (F11). Allow the microphone and location once beforehand. Edge usually offers online Bengali voices for read-aloud; Chrome on Windows often has none. |
| Backup | Keep a second tab open on `/dashboard`. Pages retry on their own if the backend is slow to answer. |

## The 5-minute script

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Home | Let the hero animate in | "Every season, a farmer bets on what to plant, often with little warning of flood or drought. FarmShield gives every farm satellite eyes." |
| 0:20 | Home → How it works | Scroll slowly; the line draws itself | "NASA missions measure rain, soil water and crop greenness. We turn that into one clear answer, in the farmer's language." |
| 0:40 | Rotation (Barind) | Choose **Barind Wheat Farm**, tap **More income**: the third idea changes to potato. Pick **Sandy** soil, then go back to **Not sure** | "The challenge asks us to help farmers explore rotations. The farmer says what they grow, what matters most and what their soil feels like. We compare their rotation with three others. Asking for more income brings in potato, but look at the water it needs." |
| 1:15 | Rotation | On **Mustard → Mungbean → Aman rice**, open **Benefits, gaps and risks** | "Their rotation now leaves the field bare for four months; this one, for two. Each idea gives its reasons, NASA evidence, benefits, what we don't know and local risks. These are ideas to discuss, not orders." |
| 1:40 | Rotation | Scroll to the groundwater chart; point at 2003, then the newest year | "NASA GRACE shows groundwater at the end of each dry season. Here it was low in 3 of the first 10 years and 7 of the last 10, so rotations that pump a lot score lower. GRACE sees a wide area, not one field, and the page says so." |
| 2:05 | Rotation (Sunamganj) | Switch to **Haor Rice Field** | "Haor land is under water from May to October, so every idea here uses only the dry months." |
| 2:20 | Dashboard (Haor) | Overall ring, then **My field today**: press **Play last 2 weeks**. Switch to **বাংলা** in the header and click the **Flood risk** card | "This is the farmer's field, drawn from the data. Watch the water rise as the risk grows. One tap puts it all in Bengali, and every risk shows its reasons, each from a named NASA source." |
| 2:50 | Dashboard | **Today's SMS alert** card, on a field at warning or danger today (the card is empty on calm days; `npm run warm` prints each farm's level) | "On days that need action, this is the short message for a basic phone, in Bengali. Quiet days send nothing, so a text always means act now." |
| 3:05 | Map → world | Switch layers Flood → Water → Crop; then **Whole world**, turn on **Soil moisture**; tap East Africa | "The same engines score all of Bangladesh with no sensors in the field. And these are NASA's own global layers: tap any spot on Earth, and FarmShield checks it in seconds." |
| 3:35 | Add my farm | Search **Giza**, pick the first result, choose **Wheat**, save | "A farmer anywhere can add their field. On the edge of the desert, water stress is the danger here." |
| 4:00 | Assistant | Switch to **বাংলা**, tap "এই সপ্তাহে কি বন্যার ভয় আছে?", then ask by microphone | "Farmers can simply ask by voice, in their own language. Answers come only from the farm's facts, with no made-up numbers." |
| 4:25 | Data | The five mission cards and the pipeline flow | "Everything is open NASA data: SMAP, GPM IMERG, MODIS, VIIRS, GRACE, POWER and SRTM, refreshed automatically." |
| 4:45 | Home | Closing section | "Better crop choices for the years ahead, and warnings before the water arrives, for any farm on Earth." |

Check the field note on Barind before presenting: if new NASA data has changed the 3 and the
7, say the new numbers.

**In demo mode** (`npm run demo`), skip 0:40–2:20 and the world and Giza parts. Instead add a
Bangladeshi farm (choose a division and district, pick a crop, save), and spend the extra time
on the dashboard and the assistant. Say plainly that the planner runs on live data.

## Likely questions

**Which NASA data do you use?** SMAP (soil moisture), GPM IMERG (rainfall), MODIS (NDVI
greenness), VIIRS (the seasonal greenness normal), GRACE (groundwater over the years), NASA
POWER (rain, soil wetness, temperature, humidity and the climate normal), SRTM (land height)
and GIBS (map imagery and the global layers). The non-NASA inputs are the weather forecast
(Open-Meteo, with MET Norway as backup) and place names (OpenStreetMap, with Photon as backup).

**How does the rotation planner decide?** It scores each rotation on soil health, water
saving, climate and soil fit, pest break, income and family food, weighted by the farmer's
priorities. NASA data supplies the climate, land height, greenness and groundwater; the farmer
supplies the current rotation, irrigation and soil type. It always compares the current
rotation with three ideas, and says why, the evidence, the benefits, the gaps and the risks.
The crop values and soil penalties are our own estimates, still to be checked with local experts.

**How do you use GRACE, and how far can it be trusted?** We read a weekly NASA product that
assimilates GRACE and GRACE-FO into a land model, as a percentile against 1948–2012, for late
April each year since 2003. A field counts as running low with at least 4 low years in the last
10, and 2 more than in the first 10. It sees a wide area, not one field, and arrives about two
months late, so it suits a long-term trend, not today's decision. A tubewell's water level would
sharpen it, and the page says so. See `docs/DECISIONS.md`.

**Do you know the farmer's soil?** Only what the farmer tells us: clay, loam, sandy or not sure,
with a simple feel test. It changes the water needs and crop fit. A soil test would sharpen it.

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

**Has it been validated?** Not against past disasters or with farmers yet. The engines are
unit-tested and checked against today's real data. Planned: backtests on the 2022 Sylhet floods
and the 2016 wheat blast outbreak, and trials with farmers and agriculture officers.

**What if a data service goes down?** Every outside service has a fallback. When the
forecast service refused our server, the forecast switched to MET Norway and the map's
weather to NASA POWER; place names are optional; the map serves its last good version.
The dashboards say plainly when something is missing.

**What about farmers without smartphones or internet?** On warning or danger days FarmShield
writes a short SMS in the farmer's language, and logs every day's decision automatically. Real
sending works through Twilio, limited for now to test numbers and a daily cap, so no farmer gets
these messages yet. The assistant also works without the AI model.

## Troubleshooting

| Symptom | Fix |
|---|---|
| The first page takes a minute | Render was asleep. Run `npm run warm` (or `-- --awake` to keep it up) before presenting. |
| Map legend says "Getting live data…" | The server just started and is building today's map; it swaps in by itself within a minute. |
| Place search takes a few seconds | The first search for a name asks OpenStreetMap; the same search later is instant. `npm run warm` pre-loads "Giza" and "Kiambu". |
| Place search says it "isn't answering" | Both name services refused our server, which then waits a few minutes before asking again. Tap the field on the map instead. A ✗ on "Kiambu" in `npm run warm` doesn't affect this guide, which only searches "Giza". |
| A farm says "Still downloading NASA data" | Its NASA download is running (for the demo farms too, for a minute or two after a deploy); the page retries by itself. We never show demo risks as today's. |
| Home has no farm cards yet, or the map has no farm markers | The same download. They appear by themselves within about two minutes. |
| A new farm's first crop plan takes up to 20 s | It is downloading the field's groundwater history. Open that plan once beforehand. |
| The groundwater chart is missing, or `npm run warm` shows ✗ "no groundwater yet" | The server was just deployed and GRACE downloads last. Wait a few minutes and run it again. |
| The Rotation page says it "needs live NASA data" | The server runs the demo scenario. Use the live site or `npm run dev`. |
| Farm cards missing on Home | The backend is still starting. Pages retry automatically; reload if it takes more than 15 s. |
| Data page says GPM "needs approval" | Approve the GES DISC app in your Earthdata profile (link on the page). NASA POWER rainfall stands in meanwhile. |
| Map has no imagery | The basemap and NASA world layers need internet. The risk layers still draw. |
| "Listen" is greyed out | The device has no voice for that language. Use Edge, or install a voice in the OS speech settings. |
| Everything is calm on stage | Say so: a calm day is a real result. For the flood story, show `npm run demo` in a second window and call it a sample scenario. Keep the planner and world segment on live data. |
