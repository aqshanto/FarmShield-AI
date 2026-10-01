# FarmShield AI: Demo & Presentation Guide

A 5-minute walkthrough for the NASA Space Apps judging, plus a checklist and answers to
likely questions.

## Before you present

| When | Check |
|---|---|
| The day before | `npm run setup` on the presenting laptop, then `npm run dev` and click through every page once. This fills the NASA data cache, so later starts are instant. |
| Choose the mode | **Live** (`npm run dev`) shows today's real NASA data, which is often calm. **Demo** (`npm run demo`) shows the bundled scenario with a haor flood danger and a Barind drought. It is dramatic, repeatable and needs no NASA downloads. |
| Internet | Demo mode runs the app without NASA access. The map's satellite basemaps (NASA GIBS) and voice recognition still need internet. Everything else works offline. |
| AI answers | Optional: put `ANTHROPIC_API_KEY` in `backend/.env` for Claude-written answers. Without it the built-in helper answers common questions in both languages. |
| Browser | Chrome or Edge, full screen (F11). Allow the microphone once beforehand. Edge usually offers online Bengali voices for read-aloud; Chrome on Windows often has none. |
| Backup | Keep a second tab open on `/dashboard`. If the backend starts slowly, pages retry on their own for a few seconds. |

## The 5-minute script

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00 | Home | Let the hero animate in | "Bangladesh's farmers lose crops to floods, dry spells and disease, often with little warning. FarmShield gives every farm satellite eyes." |
| 0:30 | Home → How it works | Scroll slowly; the line draws itself | "Four NASA missions measure rain, soil water and crop greenness. We compare today with what is normal and turn it into one clear answer, in Bengali." |
| 1:15 | Home → farm cards | Point at the three different levels | "Three real places, three different stories, read from the same pipeline." Click **Open farm** on the Haor. |
| 1:30 | Dashboard | Overall ring, then **My field today**: press **Play last 2 weeks** | "This is the farmer's own field, drawn from the data. Watch the water rise as the flood risk grows. No numbers needed." |
| 2:00 | Dashboard | Switch the field to **বাংলা**, then click the **Flood risk** card | "Every risk has the reasons, each from a named NASA source, and the 14-day trend." |
| 2:30 | Map | Switch layers Flood → Water → Crop, click a farm, try the night-lights basemap | "The same engines run across 744 land areas of Bangladesh, so this scales to every district with no sensors in the field." |
| 3:20 | Assistant | Switch to **বাংলা**, tap "এই সপ্তাহে কি বন্যার ভয় আছে?", then ask by microphone | "Farmers can simply ask by voice, in their own language. Answers come only from the farm's facts, with no made-up numbers." |
| 4:20 | Data | Mission cards and the pipeline flow | "Everything is open NASA data: SMAP, GPM IMERG, MODIS, VIIRS and POWER, refreshed automatically." |
| 4:45 | Home | Closing section | "Warnings that arrive before the water does." |

## Likely questions

**Which NASA data do you use?** SMAP (soil moisture), GPM IMERG (rainfall), MODIS (NDVI
greenness), VIIRS (the seasonal greenness normal), NASA POWER (rain, soil wetness,
temperature, humidity and the climate normal), SRTM (elevation) and GIBS (map imagery).
The only non-NASA input is the weather forecast (Open-Meteo).

**How are the risks calculated?** With explainable, weighted scorecards rather than a
black box. Each risk lists its reasons (for example "heavy rain on the way", "ground
already full", "low-lying field") with the NASA source behind each one, and a confidence
level. Missing data lowers the confidence instead of breaking the answer.

**Why not machine learning?** There is no labelled field-loss data for these farms yet,
and farmers and extension officers need to see why a warning was raised. The scorecards
are transparent and tested; calibrating them against reported losses is the next step.

**Has it been validated?** Not against past disasters yet. The engines are unit-tested
and checked against today's real data. Planned: backtests on the 2022 Sylhet floods and
the 2016 wheat blast outbreak.

**Does it scale?** The data is free and global. The map already scores all of Bangladesh
at about 20 km resolution; adding a farm needs only its location and crop.

**What about farmers without smartphones or internet?** The assistant works without the
AI model, and the advice is short enough for SMS or voice calls, which is the natural next
channel.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Farm cards missing on Home | The backend is still starting. Pages retry automatically; reload if it takes more than 15 s. |
| Data page says GPM "needs approval" | Approve the GES DISC app in your Earthdata profile (link on the page). NASA POWER rainfall stands in meanwhile. |
| Map has no imagery | The basemap tiles need internet. The risk layers still draw. |
| "Listen" is greyed out | The device has no voice for that language. Use Edge, or install a voice in the OS speech settings. |
| Everything is calm on stage | Switch to `npm run demo` for the dramatic scenario. |
