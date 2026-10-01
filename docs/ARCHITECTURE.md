# Architecture

```
Browser (React)  ──/api/v1──▶  Vite dev proxy  ──▶  FastAPI (backend)
                                                    ├── data providers (sample | live NASA)
                                                    └── risk engines (flood, water, crop)
```

In development the frontend calls relative `/api/v1/...` URLs and Vite proxies them to
`127.0.0.1:8000`, so there are no CORS issues and no hard-coded hosts. In production,
set `VITE_API_BASE_URL` to the deployed API.

## Backend (`backend/`)

| Path | Responsibility |
|---|---|
| `app/main.py` | `create_app()` factory: CORS, router mounting |
| `app/core/config.py` | Typed settings from env vars / `.env` (pydantic-settings) |
| `app/api/v1/router.py` | Aggregates v1 routers; each feature adds one line here |
| `app/api/v1/endpoints/` | One module per feature (`meta.py` today) |
| `app/schemas/` | Pydantic request/response models, the API contract |
| `app/data/sources.py` | Catalog of NASA sources and which risk modules use them |
| `app/data/` | Phase 4: providers per source (sample and live) |
| `app/services/` | Phase 5: risk engines (pure logic, no HTTP) |
| `tests/` | pytest + FastAPI TestClient |

**Adding a feature:** schema in `schemas/` → logic in `services/` → endpoint in
`api/v1/endpoints/` → register in `router.py` → test in `tests/`.

### Current endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/health` | App status, version, data mode |
| GET | `/api/v1/sources` | NASA sources (SMAP, GPM, MODIS, VIIRS) |
| GET | `/api/v1/region/default` | Default focus region (Bangladesh) |
| GET | `/api/v1/farms` | Farm list (id, name, district, crop) |
| GET | `/api/v1/farms/{id}/dashboard` | Everything the dashboard shows (404 for unknown farms) |
| GET | `/api/v1/map/overview` | Risk grid (0.2° cells × 3 layers), layer metadata, farms with levels |
| GET | `/api/v1/map/point?lat&lon&crop` | Live flood, water and crop risk for any spot on Earth, with place name and top actions (409 in demo mode) |
| GET | `/api/v1/assistant/status` | Which assistant engine answers (`claude` or `offline`) |
| POST | `/api/v1/assistant/chat` | Streams a farmer's answer as server-sent events |

### Dashboard data flow

`app/data/sample/farms.py` (3 demo farms) → `app/services/dashboard.py` (dates relative to
today, score = last trend value, level, 7-day change, priority sort) → `Dashboard` schema.
Phase 4/5 replace only the sample lookup; the schema stays the same.

`app/services/risk.py` holds the shared vocabulary:
- `score_to_level`: 0–24 safe · 25–49 watch · 50–74 warning · 75–100 danger (same as `frontend/src/lib/risk.ts`).
- `overall_score = worst + 0.25 × mean(other real risks)`. Only modules at watch or worse
  add to it, and the result is capped at 100 and at one level above the worst module, so
  one watch beside two safe modules stays a watch. The overall level is
  **never calmer than the worst module**, and several medium risks outrank a single one.

## Frontend (`frontend/src/`)

| Path | Responsibility |
|---|---|
| `app/` | App shell: providers (`MotionConfig`), router (titles in `handle.title`), `routes.ts` lazy page loaders + prefetching |
| `pages/` | Route-level screens that compose features |
| `features/<name>/` | Self-contained feature modules: components, hooks, tests |
| `components/ui/` | Design-system components (see below) |
| `components/illustrations/` | Data-driven SVG illustrations (Sun, RainCloud, Sprout, WaterDrop) |
| `components/layout/` | App shell: `AppLayout` (nav, page transitions, scroll restoration, tab titles, loading bar, prefetch), `Starfield` |
| `lib/api.ts` | Typed API client, the only place that calls `fetch` |
| `lib/risk.ts` | 0–100 score → `safe / watch / warning / danger`, with EN + BN labels and advice |
| `lib/motion.ts` | Shared springs and variants (`fadeUp`, `pop`, `stagger`) |
| `lib/cn.ts` | `clsx` + `tailwind-merge`, aware of the custom tokens |
| `lib/useAsync.ts` | Keyed async loading with abort, stale data kept while reloading, optional quiet retries of 5xx/network errors |
| `types/api.ts` | TypeScript mirror of backend schemas |
| `config/env.ts` | Runtime config from `VITE_*` env vars |
| `styles/index.css` | Tailwind v4 + theme tokens |
| `test/setup.ts` | Vitest + Testing Library setup |

Imports use the `@/` alias for `src/`.

**Adding a feature:** create `features/<name>/`, add API calls to `lib/api.ts` and
types to `types/api.ts`, then add a route in `app/router.tsx`.

## Dashboard (`/dashboard`)

| Piece | File | Notes |
|---|---|---|
| Page | `pages/DashboardPage.tsx` | Farm in the URL (`?farm=`), skeleton → content, stale-while-switching dimming, 404 vs offline errors |
| Header | `features/dashboard/FarmHeader.tsx` | Greeting, farm chips, satellite-pass time, farm switcher |
| Overall | `features/dashboard/OverallCard.tsx` | The page's one hero figure + summary + module shortcuts |
| Checklist | `features/dashboard/RecommendationList.tsx` | Priority order, tick-off with toast + burst, progress bar; saved per farm in `localStorage` |
| Risk cards | `features/dashboard/RiskCard.tsx` | Whole card is one button (`aria-expanded`), metrics with NASA source, 7-day change |
| Details | `features/dashboard/RiskDetailPanel.tsx` | Explanation, `TrendChart`, plain-language source descriptions |
| Forecast | `features/dashboard/ForecastStrip.tsx` | 7 days, rain columns, heavy-rain / very-hot callouts |

`lib/useAsync.ts` is the data-fetching hook: keyed requests, abort on change, previous
data kept while loading, `retry()`.

## NASA data pipeline (`backend/app/pipeline/`)

```
sources (fetch) ──► clean & grade ──► SQLite store ──► serve (best source per variable)
      ▲                                     │
      └──── CMR: newest granule per mission (freshness)
```

| Mission | Source (`sources/`) | Login | What we get |
|---|---|---|---|
| GPM | `opendap.ImergSource`: GPM_3IMERGDL v07 via Earthdata Cloud OPeNDAP | token | Daily rainfall, one 0.1° cell |
| SMAP | `opendap.SmapSource`: SPL3SMP_E v006 via OPeNDAP (EASE-Grid 2.0 9 km lookup in `grids.py`) | token | Soil moisture m³/m³ (AM pass, PM fallback) |
| MODIS | `ornl.ModisNdviSource`: MOD13Q1 + MYD13Q1 v061 (Terra + Aqua) via ORNL DAAC | none | 16-day NDVI, graded by pixel reliability |
| VIIRS | `ornl.ViirsNormalSource`: VNP13A1 via ORNL DAAC | none | 2013–2023 seasonal NDVI **normal** (median) |
| (stand-in) | `power.PowerSource`: NASA POWER daily point API | none | Rainfall, surface/root-zone wetness, max temperature |
| all four | `catalog.py`: CMR granule search | none | Newest granule time per mission |

**How it runs** (`service.PipelineService`):
- Every (source × farm) job runs concurrently, with a timeout and **isolated failures**.
- **Cache-aware:** each source has a TTL, so fresh data isn't re-downloaded.
- **Incremental:** only days after the newest stored day, minus an overlap (providers revise recent data).
- Slow or cloud-prone data (NDVI) always looks back 120 days.
- **Serving** merges each variable from its preferred sources in order (e.g. GPM → POWER), keeping the source on every point.

**Quality control:** fill values dropped, NDVI scaled, pixel-reliability flags mapped **per
product** (MODIS 0–3 and VIIRS 0–11 differ). Rejected (cloudy) rows are stored for audit but
never served. Monsoon clouds hide optical sensors for months; the UI says so.

**Storage:** `store.py`, SQLite (`backend/data/farmshield.db`, git-ignored). Tables:
`observations` (upserted by source/variable/location/date), `fetch_log`, `cache`.

**Entry points:** API startup (background, `PIPELINE_AUTO_REFRESH`), `POST /api/v1/data/refresh`,
and the CLI `python -m app.pipeline refresh|status`.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/data/status` | Sources' state, mission freshness (CMR), last run summary |
| POST | `/api/v1/data/refresh` | 202; starts a background refresh (`?force=true` ignores cache) |
| GET | `/api/v1/farms/{id}/observations?days=60` | Merged series per variable, with provenance |

**Frontend:** `/data` (`pages/DataPage.tsx`, `features/data/`) shows the pipeline flow,
the missions' states, a token how-to, and the farm's charts via `components/ui/TimeSeriesChart.tsx`.

## Flood risk engine (`backend/app/risk/`)

An explainable scorecard. Each factor is scored 0–100 and weighted:

| Factor | Weight | Inputs | Scale |
|---|---|---|---|
| Water arriving | 40% | Rain in the last 3 days + the next 3 (GPM → POWER → forecast) | 200 mm over the 6 days = 100 |
| Ground is full | 25% | Soil saturation: SMAP ÷ 0.50 porosity, else POWER wetness | 40% → 0, 90% → 100 |
| Unusually wet | 15% | Last 7 days against the NASA POWER normal for this month | normal → 0, 3× → 100 |
| Low-lying land | 20% | NASA SRTM elevation | ≥ 40 m → 0, ≤ 8 m → 100 |

- Under 20 mm of rain across the 6-day window, the score is capped at 45 (watch).
- Missing inputs drop out and the weights re-normalise. **Confidence** is high (SMAP + all
  factors), medium (stand-ins) or low (missing inputs).
- The explanation cites the two strongest factors. A *safe* result explains why it's safe instead of listing alarms.
- The 14-day trend re-scores each day with the rain actually around it.

| File | Role |
|---|---|
| `flood.py` | Pure engine: `assess_flood`, `score_factors`, `flood_trend`, advice per level |
| `inputs.py` | Pipeline observations → `FloodInputs` (source preference, SMAP freshness, porosity) |
| `live.py` | Engine → dashboard module, recommendations, and the live 7-day forecast (WMO codes) |
| `grid.py` weather | Open-Meteo multi-point, sampled on a 0.4° lattice (each point serves the 0.2° cells around it), cached 6 h; on a 429 the map keeps its last weather and pauses 30 minutes |
| `water.py` | Water-stress engine + irrigation decision (see below) |
| `crop.py` | Crop-health engine with crop profiles (see below) |
| `grid.py` | Flood, water **and** crop engines per 0.2° land cell from shared inputs: SRTM (batched, cached for a year), weather (30 days back + 5 ahead: rain, high/mean temperature, humidity; multi-point, 3 h), SMAP bounding-box subsets (newest valid pass over 3 days, 6 h) |

`DATA_MODE=live` (default) puts the flood, water and crop engines on the dashboard, all three map layers and
`GET /api/v1/farms/{id}/flood` (the full evidence). Modules without an engine yet stay on
the demo scenario and are marked **Demo** in the UI. The grid is pre-computed after each
background refresh, so the map loads instantly.

New pipeline sources:
- `forecast.ForecastSource` (Open-Meteo; the one non-NASA input). When Open-Meteo refuses
  (HTTP 429: its free quota is per server address, and cloud hosts share addresses) or fails,
  the forecast comes from MET Norway's Locationforecast instead, and Open-Meteo is paused for
  15 minutes. Without any forecast, farms and spot checks still load on NASA's measured rain,
  and the dashboard says the forecast is unavailable.
- Rate limits: `http.get` raises `RateLimitedError` on 429 at once (no backoff), except where a
  per-second limit is worth waiting for (OpenTopoData batches).
- `static.SrtmElevationSource`
- `static.PowerClimatologySource`

Earthdata errors are explained:
- 401 → token missing or invalid.
- 403 "EULA" → `needs_approval`, with the archive's approval link. GES DISC (GPM) needs this once per account.
- OPeNDAP returns a blank for single-cell selections, so point subsets request two cells (`pair_slice`).

## Water stress engine (`backend/app/risk/water.py`)

| Factor | Weight | Inputs | Scale |
|---|---|---|---|
| Topsoil drying | 25% | SMAP ÷ porosity (a fresh SMAP reading is preferred over newer POWER ones), else POWER | 75% wet → 0, 25% → 100 |
| Roots are thirsty | 20% | NASA POWER root-zone wetness | 80% → 0, 35% → 100 |
| Rain shortfall | 20% | Last 30 days against the NASA POWER monthly normals | normal → 0, none → 100 |
| Heat | 15% | Daily highs, 3 days back + 3 ahead (POWER + forecast) | 30°C → 0, 40°C → 100 |
| No rain coming | 10% | Forecast rain, next 5 days | 30 mm → 0, dry → 100 |
| Plants show stress | 10% | MODIS NDVI against the VIIRS normal (clear view within 32 days) | 0.25 below normal → 100 |

- A week with ≥ 1.5× normal rain caps the score at 24 ("a soaking is not a drought").
- **Irrigation decision** (`RiskAction` on the module):
  - *Hold off, rain is coming* when ≥ 20 mm is forecast in 3 days. This saves water and pumping cost, and it wins over irrigating.
  - Otherwise by level: danger → *irrigate today*, warning → *within 2 days*, watch → *check the soil in 2–3 days*, safe → *no irrigation needed*.
- `GET /api/v1/farms/{id}/water` returns the full report. The dashboard shows the decision as a pill on the card and a "What to do now" banner in the detail panel.
- On the map, root-zone and vegetation factors drop out (farm-only data) and the engine re-normalises.

## Crop health engine (`backend/app/risk/crop.py`)

| Factor | Weight | Inputs |
|---|---|---|
| Less green than normal | 30% | Latest clear MODIS NDVI (≤ 45 days old, NDVI ≥ 0.1) against the VIIRS seasonal normal |
| Greenness falling | 15% | Change between the last two clear views, per 16 days |
| Thirsty crop | 20% | The water engine's live score |
| Heat stress | 15% | Days (last week + next 3) above the **crop's** heat limit |
| Waterlogging | 10% | The flood engine's live score |
| Disease weather | 10% | Days (last 5 + next 3) with humidity ≥ 90% in the crop disease's temperature band (rain stands in without humidity) |

Crop profiles:

| Crop | Heat limit | Disease | Band |
|---|---|---|---|
| Rice | 35°C | Blast | 24–30°C |
| Wheat | 32°C | Wheat blast | 25–30°C |
| Potato | 29°C | Late blight | 10–25°C |
| Other | 35°C | Generic fungal disease | 20–30°C |

Honesty rules:
- NDVI < 0.1 means water or bare soil. It's excluded from greenness, and the text says the field showed water.
- A view older than 45 days never becomes a greenness number.
- Without a clear view, the explanation says clouds hid the field and speaks only about conditions.
- A severe *visible* decline (greenness factor ≥ 80) keeps the score at "warning" or worse, so kind weather can't dilute it.

Outputs:
- `CropIndicators` (greenness vs normal, last clear view, heat days of 10, disease days of 8) drive the "Crop health at a glance" visuals.
- Advice is ranked by factor and crop-specific (blast, late blight, evening watering, drainage).

Humidity and mean temperature come from NASA POWER (`RH2M`, `T2M`, observed) and the forecast.
The map's crop layer uses the rice profile per cell. Greenness is only checked at farms.

## AI Farmer Assistant (`/assistant`, `backend/app/assistant/`)

A chat helper that answers in English or Bengali, grounded in the farm's own risk results.

```
question ─► build_dashboard(farm)  (same live engines as /dashboard)
               │
               ├─ ANTHROPIC_API_KEY set ─► facts.fact_sheet() ─► Claude (streamed)
               │                              │ refusal / API error
               │                              ▼
               └─ no key ───────────────► offline.reply()  (built-in bilingual helper)
                                              │
                               SSE: meta → delta… → (replace) → done
```

| Piece | Role |
|---|---|
| `facts.py` | Dashboard → plain-language fact sheet: levels in words, reasons, actions, 7-day forecast, advice. Greenness becomes "% of normal", never raw NDVI. Demo modules are labelled "demo scenario". |
| `claude.py` | `claude-opus-5-5`, effort `low`, adaptive thinking (the model default), streaming, `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). System prompt = fixed rules + fact sheet. |
| `offline.py` | Topic detection (English + Bengali keywords), answers from engine levels and actions. English reuses the engines' own text; Bengali uses hand-written templates, Bengali digits and possessives. |
| `service.py` | Picks the engine, trims history (last 20 turns, 1 500 chars each, starting with the farmer), streams events; a Claude failure mid-reply sends `replace` with the built-in answer. |

Rules the assistant follows:
- **Language:** Bengali script in the question always gets a Bengali reply; otherwise the chosen language.
- **Grounding:** only the fact sheet's conditions and forecast; says so when the facts don't cover a question.
- **Safety:** doses, health and loans get general guidance plus the Upazila agriculture office or the Krishi Call Centre (16123).
- **Voice-friendly:** plain text, no markdown or emoji.

Frontend (`features/assistant/`):
- `useChat` streams replies via `streamChat` (fetch + SSE parser). It keeps one conversation per farm; the greeting is rendered in the current language, not stored.
- `speech.ts` wraps the Web Speech API: recognition (`bn-BD` / `en-US`) and synthesis. The "Listen" button is disabled with a reason when the device has no voice for that language (many Windows PCs have no Bengali voice). Spoken questions get spoken answers.
- The animated `AssistantAvatar` orbits faster while thinking, breathes while speaking and glows while listening.

## Add my farm (`/farms/new`, `services/custom_farms.py`)

Farmers add their own fields: any point in Bangladesh, any of 10 crops.

```
/farms/new  ──►  1 Where: GPS · division → district · tap the map (street map or NASA satellite)
                 2 Crop: Boro/Aman/Aus rice, wheat, maize, potato, jute, mustard, lentil, tomato
                 3 Name ──► saved in the browser (lib/myFarms.ts) ──► /dashboard?farm=my_<lat>_<lon>_<crop>
```

| Piece | Role |
|---|---|
| `my_<lat>_<lon>_<crop>` id | The whole farm. The server keeps no per-user state, and the id works in every existing endpoint (dashboard, assistant). |
| `GET /places`, `/crops`, `/locate` | 8 divisions and 64 district towns (EN/BN); crop list; "is this point in Bangladesh, near which district town?" |
| `ensure_data()` | Fetches the quick sources (POWER, forecast, SRTM, climatology) for the ~1 km point on the first visit, in about 2 seconds, without waiting for the global refresh lock. MODIS, VIIRS, GPM and SMAP follow in the background and raise confidence on the next visit. |
| `build_custom_dashboard()` | Every risk from the live engines; no demo fallback. Missing data → 503 "Still downloading…", and the page retries. Demo mode → 409. |
| Crop profiles | 5 new crops (maize, jute, mustard, lentil, tomato) with heat limits and disease weather; sources in DECISIONS.md. |
| Frontend | `FarmPicker` (own fields first, then demo farms, then "+ Add my farm") on the dashboard and assistant; saved fields on the map; "Add a farm here" on any tapped map spot; rename/remove in the farm header. |

Notes:
- **Map:** the picker uses OpenStreetMap tiles (with Bengali village names) as the default view, since NASA GIBS imagery is too coarse to find a field and its label layers return blank tiles. NASA relief imagery is one tap away.
- **Privacy:** saved fields stay on the farmer's device (`localStorage`, max 20).

## Languages (English and Bengali)

- **Store:** `lib/i18n.ts` holds the app language (`useLang`, `setLang`, `useText`). The header's
  language button flips it; the choice is saved and also sets `<html lang>`.
- **Frontend words:** each component has `const text = { en: {...}, bn: {...} }`. Helpers:
  `digits()` (Bengali numerals), `formatDate()` (`bn-BD`), `bnOf()` (Bengali possessive).
  `AnimatedNumber`, `Spinner`, `OrbitLoader`, charts and toasts follow the language by default.
- **Backend words:** `app/i18n/bn.py` is the catalog (English template → Bengali);
  `app/i18n/__init__.py` `translate()` splits sentences, fills slots and converts digits;
  `app/i18n/localize.py` translates a whole dashboard, farm list or map overview
  (names, places, crops, sources, metric units).
- **API:** `?lang=bn` on `GET /farms`, `GET /farms/{id}/dashboard`, `GET /map/overview`.
- **Tests:** `backend/tests/test_i18n.py` fails if any engine or demo sentence has no Bengali.

## Living field view (`features/field/`)

The dashboard's "My field today" card draws the farmer's field as a living picture of the
risks.

| File | Role |
|---|---|
| `fieldState.ts` | Pure rules: scores → water level, dryness, sickness, heat, disease, rain; stage words (EN/BN) |
| `FieldScene.tsx` | Layered SVG: sky, sun and haze, clouds and rain, hills, soil and cracks, 9 crop-specific plants, puddles or water drawn over the plants |
| `FieldView.tsx` | Card: language switch, All / Flood / Water / Crop focus, stage meters, signal chips, danger warning, 2-week replay |

Rules:
- **Same scale as every risk.** The four stages map to safe / watch / warning / danger, and each stage's look matches its words (anchored per level band).
- **Crop-aware.** Rice keeps normal paddy water when safe, and that water drains as the soil dries. For wheat and potato, any standing water is already a warning sign.
- **Honest.** It says it's "a picture of today's risks, not a photo". The danger stage reads "could be damaged, act today", never "damaged". The replay shows only the three trended risks; today's heat, rain and disease signals aren't projected into the past.
- **Patchy, not uniform.** Each plant has its own sensitivity, so trouble spreads plant by plant.
- **Accessible.** The scene and every stage meter have text names; colours change through CSS transitions; reduced motion stops the sway, waves and rain.

The design-system page has a gallery of all four stages for every crop and risk.

## Home page (`/`) and app polish

The landing page tells the story for first-time visitors and judges:
- **Hero:** the orbit illustration, with calls to action for the dashboard, the Bengali assistant and the map.
- **Live pulse:** counts from `/map/overview` (missions, land areas checked, farms watched).
- **How it works:** a four-step scroll story; a line draws as you scroll (`useScroll`), and each step has a small animated visual.
- **Farm cards:** live levels for each farm, with links into the dashboard and the assistant. They are hidden if the backend is unreachable, so the story still stands.

App-wide polish:

| Concern | How |
|---|---|
| Speed | Pages are code-split. Dashboard, Assistant and Data warm up when the browser is idle; the heavy map loads on hover/focus of its link. A glowing top bar shows while a page loads. |
| Resilience | `useAsync` retries server and network errors a few times before showing an error, so a backend that starts late heals itself. Render errors show `RouteErrorPage` (reload / home) instead of a crash. |
| Accessibility | Framer animations follow `MotionConfig reducedMotion="user"`; CSS animations stop under `prefers-reduced-motion`. Every page sets a descriptive tab title. |
| Demo | `npm run demo` starts the API with `DATA_MODE=sample` and no NASA refresh (`scripts/api-dev.mjs --demo`). See `docs/DEMO.md`. |

## Dev server note (Windows)

`npm run dev:api` runs `scripts/api-dev.mjs`, which watches `backend/app` and restarts
uvicorn itself instead of using `uvicorn --reload`. On Windows the reloader restarts its
worker with a console-wide Ctrl+C that also killed npm, `concurrently` and the frontend
on every backend edit.

## Map (`/map`)

**Backend:** `app/data/sample/grid.py` builds three risk surfaces on a 0.2° grid (~20 km)
from hotspots placed where each risk really concentrates (Sylhet haor and Jamuna floods,
Barind drought, saline south-west coast), plus deterministic noise. Near each demo farm
the surface is pulled to that farm's score, so **map and dashboard always agree**
(tested). Phase 4 swaps in gridded SMAP / GPM / MODIS on the same cell layout.

**Frontend:**

| Piece | File | Notes |
|---|---|---|
| Page | `pages/MapPage.tsx` | Layer + farm in URL (`?layer=&farm=`), legend, basemap switch, side panels, scan sweep, WebGL fallback |
| Map | `features/map/MapCanvas.tsx` | Imperative MapLibre wrapper; markers are React portals into MapLibre marker elements |
| Styling | `features/map/map-style.ts` | Raster basemap style; risk `step` color expression (alpha grows with risk) |
| Imagery | `features/map/basemaps.ts` | NASA GIBS: Blue Marble relief, MODIS true color (yesterday), VIIRS Black Marble; no API key |
| Geometry | `features/map/geo.ts` | Bundled Bangladesh outline, point-in-polygon clipping, cell lookup, distances |
| Outline | `features/map/data/bangladesh.geo.json` | Generated by `frontend/scripts/extract-bangladesh.mjs` from Natural Earth 1:10m |
| World layers | `features/map/nasaLayers.ts`, `NasaLayerControls.tsx` | NASA GIBS global layers under the grid: SMAP L4 soil moisture, GPM IMERG rainfall, MODIS Terra 8-day greenness. Legend colors sampled from the official GIBS color maps; the picture date comes from GIBS DescribeDomains. Linkable as `?nasa=soil|rain|green` |
| World spots | `features/map/WorldSpotPanel.tsx` | A tap outside Bangladesh calls `/map/point`: step-by-step scanning animation, place name, three risks, top actions, crop chips |

**Global map (Stage A).** The map zooms out to the whole world ("Whole world" button). Bangladesh
keeps its detailed 0.2° risk grid (dimmed while a NASA world layer is on); anywhere else a tap
runs the same engines for that one point (`backend/app/services/point_risk.py`):

- Quick sources answer in about 2–3 s (NASA POWER, Open-Meteo forecast, SRTM, POWER climatology);
  SMAP, GPM, MODIS and VIIRS start downloading in the background, and the panel says so.
- Taps within ~5 km share one cached point (`pt_<lat>_<lon>`, snapped to 0.05°).
- Place names come from OpenStreetMap Nominatim (in Bengali where OSM has them), cached 30 days
  and rate-limited to 1 request/second per its usage policy. No address means open water: no risks.
- "Today" is the spot's own calendar day (longitude / 15 h); the forecast uses `timezone=auto`.
- Crops by plain name (rice, wheat, maize, potato, tomato, lentil, mustard, jute), mapped to the
  same engine profiles as at home.

**MapLibre gotchas (all handled):**
- *Worker:* MapLibre resolves its worker next to its own module, which breaks under Vite.
  We import `maplibre-gl-worker.mjs?worker&url` and call `setWorkerUrl` (works in dev and in the build).
- *Container size:* `maplibre-gl.css` forces `position: relative` on the map container,
  so size it with `h-full w-full`, not `absolute inset-0` (otherwise height is 0).
- *Transitions:* data-driven paint (`['get', layer]`) doesn't animate, so two fill layers
  cross-fade their (constant) opacity when the risk layer changes.
- *Colors:* WebGL can't read CSS variables; `RISK_HEX` in `lib/risk.ts` mirrors the tokens
  (a test fails if they drift).

## Design system

Live showcase at **`/design`** (code-split, so it doesn't add to the main bundle).

**Tokens** (`styles/index.css`, Tailwind v4 `@theme`) are all usable as utilities:
- Surfaces `night-950…700`, `surface-1…3`, `line`. Text: `ink`, `ink-muted`, `ink-subtle`.
- Brand: `leaf` (growth), `sky` (water/satellites), `harvest` (sun/heat), `alert`.
- Risk scale: `risk-safe`, `risk-watch`, `risk-warning`, `risk-danger`.
- Utilities: `glass`, `text-gradient-brand`, `focus-ring`, `text-display`; animations `animate-shimmer`, `animate-float`, `animate-ping-soft`, `animate-spin-slow`.
- Fonts (bundled, offline-safe): Plus Jakarta Sans + Noto Sans Bengali; `lang="bn"` switches to Bengali.

**Components** (`components/ui/`):

| Component | Use |
|---|---|
| `Button` / `buttonStyles()` | Variants `primary · secondary · ghost · danger`, sizes, `loading`. Use `buttonStyles()` on `<Link>` for navigation |
| `Card` | Glass surface; `interactive` adds hover lift and a cursor spotlight in `glow` color |
| `Badge`, `RiskBadge` | Tone pills; `RiskBadge` pulses for warning/danger and supports `lang="bn"` |
| `ScoreRing` | Animated 0–100 gauge (`role="meter"`), colored by risk level |
| `TrendChart` | 14-day single-series line: 2px line, 10% wash, threshold hairlines, end label, crosshair tooltip on hover *and* arrow keys, screen-reader summary |
| `AnimatedNumber` | Counts up on scroll-in, springs to new values; Bengali numerals when the app is in Bengali |
| `Slider` | Accessible range input with a filled, colored track |
| `SegmentedControl` | Sliding-pill radio group with arrow-key navigation |
| `Skeleton`, `SkeletonText`, `SkeletonCard`, `Spinner`, `OrbitLoader` | Loading states |
| `ToastProvider` + `useToast()` | Animated notifications; `danger` toasts use `role="alert"` |

**Gotcha:** don't pass CSS-variable colors as `style.stroke` / `style.fill` on `motion.*` SVG
elements. Framer tries to interpolate them and the color goes stale. Put the color on a
plain parent `<g>` and let the motion shape inherit it (see `ScoreRing`).

## Motion & accessibility baseline

- All Framer Motion animations respect the OS "reduce motion" setting (`MotionConfig reducedMotion="user"`),
  and CSS animations are disabled under `prefers-reduced-motion`.
- Live status regions use `aria-live`; decorative illustrations are `aria-hidden`.
- Bengali text is tagged `lang="bn"`, with `Noto Sans Bengali` in the font stack.
