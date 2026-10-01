# Decision Log

Short records of choices that shape the project. Newest first.

## 2026-10-01: Final experience polish (Prompt 10)

| Topic | Decision | Why |
|---|---|---|
| Landing page | Replaced the Prompt 01 scaffold (system-status panel) with a story: hero, live pulse, scroll timeline, live farm cards | The first screen judges see should explain the idea in seconds, not show API health |
| Overall score | Only real risks (watch or worse) compound, capped at one level above the worst module | Real data (Barind, 1 Oct): three "safe" risks produced "Watch: keep an eye on water stress" while water read Safe |
| Startup race | Quiet retries for 5xx/network errors in `useAsync` | Seen in the demo stack: Vite answers before the API, the first request got a 502 and the farm cards never appeared |
| Prefetching | Idle prefetch for light pages, intent (hover/focus) prefetch for the map | Instant clicks without making every visitor download the 300 kB WebGL map |
| Demo mode | `npm run demo` = sample scenario, no NASA downloads | Stage Wi-Fi is unreliable, and live conditions are often calm; the bundled scenario shows every level |
| Navigation | "Design" moved from the nav to the footer | The farmer-facing nav should only hold farmer pages |
| Reduced motion | Global CSS rule in addition to `MotionConfig` | CSS animations (twinkle, ping, shimmer) ignored the OS setting |

## 2026-10-01: AI Farmer Assistant (Prompt 09)

| Topic | Decision | Why |
|---|---|---|
| Model | Claude Opus 5.5 at effort `low`, streamed | Latest model; chat answers are short and grounded in facts we supply, so low effort keeps them quick |
| Grounding | Facts built from the same dashboard the farmer sees | One source of truth; the assistant can't contradict the risk cards |
| No key, no problem | Built-in bilingual helper answers the common questions | The feature must work at a demo table with no key or no internet to Anthropic |
| Failures | Refusal or API error → built-in answer (`replace` event) | A farmer should never see an error where an answer could be |
| Refusals | `fallbacks: "default"` server-side fallback | Recommended default; the rare classifier decline is retried on another model in the same stream |
| History | Plain-text turns, last 20, no thinking blocks | Stateless server, nothing to keep valid between turns; facts refresh freely |
| Bengali offline | Hand-written templates keyed on levels/actions | Machine-translating engine text would read badly; templates stay natural |
| Voice | Browser Web Speech API, feature-detected | No extra service; disabled with a reason where the device lacks a voice |
| Transport | SSE over POST (fetch + reader), not EventSource | EventSource can't POST the conversation |

Real-world check (1 Oct 2026, built-in helper, live data): Bogura "আমার আলু গাছ কেমন আছে?" →
potato heat and clouds-since-June advice in Bengali; Sunamganj flood question → "watch", 12 mm
in 3 days.

## 2026-10-01: Crop health module (Prompt 08)

| Topic | Decision | Why |
|---|---|---|
| Inputs | Greenness when seen, plus water, heat, waterlogging and disease weather | Monsoon clouds hide fields for months; crop health can't wait for a clear sky |
| Crop profiles | Heat limit + main disease per crop (rice, wheat, potato) | 32°C is fine for rice but stresses potato; blast and late blight need different weather |
| Disease weather | Humidity ≥ 90% within the disease's temperature band (NASA POWER RH2M, forecast) | Standard leaf-wetness proxy; wheat blast hit Bangladesh in 2016 |
| Water on the field | NDVI < 0.1 is "no crop visible", not "sick crop" | Found in real data: the flooded haor read as −0.14 |
| Stale views | > 45 days: no greenness number and no greenness factor | A June view says nothing about October |
| Seeing is believing | Severe visible decline floors the score at warning | Test showed a 40%-below-normal field scoring only "watch" |
| Farm stories | Describe the place, not today's conditions | Static "conditions are good" contradicted a live warning |

Real-world check (1 Oct 2026): haor 15 safe (last view showed water), Barind 14 safe (clouds
since June), Bogura 44 watch (10 of 10 days above potato's 29°C limit; water stress watch).

## 2026-10-01: Water stress module (Prompt 07)

| Topic | Decision | Why |
|---|---|---|
| Output | Score **and** a single irrigation decision | Farmers act on "what do I do today", not on a number |
| "Hold off" advice | Wins whenever ≥ 20 mm of rain is forecast in 3 days | Saving water and diesel is as valuable as preventing stress |
| Soil layers | SMAP topsoil + POWER root zone as separate factors | Topsoil dries first; roots decide crop stress |
| Sensor mixing | Prefer a fresh SMAP reading over newer POWER ones | Alternating sensors day to day made the trend zig-zag (found in real data) |
| Soaking cap | ≤ 24 after a week at ≥ 1.5× normal rain | Hot days after heavy rain are not a drought |
| Vegetation | Optional factor (clear NDVI ≤ 32 days) | Monsoon clouds usually hide it; never guess |
| Map | One shared weather download feeds both engines | One request (302 cells × 35 days) instead of one per layer |

Real-world check (1 Oct 2026, monsoon ending): haor 40 watch ("check the soil"), Barind 24
safe ("no irrigation needed"), Bogura 42 watch. The map shows drying in the north and centre,
with warnings on the south-west coast.

## 2026-10-01: Flood risk module (Prompt 06)

Verified live with the user's Earthdata token:
- ✅ SMAP via OPeNDAP returns real soil moisture (0.20–0.56 m³/m³), and the EASE-Grid 2.0 index matches the data.
- ⚠ GPM returns 403 "EULA Acceptance Failure": the account must approve GES DISC once.

| Topic | Decision | Why |
|---|---|---|
| Engine style | Weighted scorecard of 4 factors with plain-language evidence | Explainable to farmers and judges; testable; no training data needed |
| Terrain | NASA SRTM via OpenTopoData | A 5th NASA dataset; a few metres decide who floods in Bangladesh |
| Historical pattern | NASA POWER monthly climatology | "3× wetter than normal for September" is meaningful and simple |
| Forecast | Open-Meteo (NOAA/DWD/ECMWF blend), clearly labelled | Early warning needs the future; NASA offers no simple point forecast |
| Dry cap | ≤ 45 when the 6-day window has < 20 mm | Local flash-flooding needs water; avoids alarm on dry weeks |
| Missing data | Drop the factor, re-normalise, lower confidence | Honest instead of guessing |
| Live map | Same engine per cell, inputs cached, pre-computed after refresh | Map and farm agree by construction; first visit is instant |
| Default mode | `DATA_MODE=live`, per-module Live/Demo marker | Real where possible; the demo scenario is still one setting away |
| Single-cell OPeNDAP | Request 2 cells, read ours | Hyrax returns an empty value for 1-element selections (verified live) |

Real-world check (1 Oct 2026, monsoon ending): haor 27 watch (very low land, light
rain), Barind 22 safe, Bogura 14 safe. The dramatic demo scenario remains in `sample` mode.

## 2026-10-01: NASA data integration (Prompt 05)

Access was probed live before designing anything:
- ✅ ORNL DAAC, NASA POWER, CMR (no login).
- ✅ Earthdata Cloud OPeNDAP for IMERG and SMAP, which redirects to Earthdata Login (token needed).
- ❌ GES DISC Data Rods, which has been discontinued.

| Topic | Decision | Why |
|---|---|---|
| Works without login | POWER + MODIS + VIIRS + CMR | The demo runs live with zero setup |
| GPM & SMAP | Mission-native via OPeNDAP point subsets when `EARTHDATA_TOKEN` is set; NASA POWER stands in otherwise | Real mission data when possible; never a dead end |
| Point subsets | One grid cell per day (DAP4 CSV) | Bytes instead of whole global HDF5 files; no netCDF/HDF5 libraries |
| VIIRS role | 2013–2023 seasonal NDVI normal | ORNL's VIIRS archive ends in 2024; a "normal for this time of year" baseline is exactly what crop-health needs |
| MODIS | Terra + Aqua | Interleaved composites double the chance of a cloud-free view |
| QA | Per-product reliability tables; rejected rows kept for audit, never served | VIIRS and MODIS use different flag scales (found in real data) |
| Storage | SQLite with upserts, fetch log, cache table | Zero-ops, file-based, plenty for farm-scale data |
| Freshness | TTL per source + incremental windows with overlap | Restarts and reloads cost nothing; providers revise recent days |
| Chart palette | `--color-chart-1` #0284c7, `--color-chart-2` #d97706 | Only pair to pass every dataviz validator check on our dark surface |
| Dev reload | Custom file watcher instead of `uvicorn --reload` | Windows reloader's Ctrl+C killed the whole dev stack |

### Known limits
- ORNL publishes MODIS composites about 6 weeks after capture, and the monsoon hides fields
  for months. The UI shows "last clear view" plus the cloud gap instead of pretending.
- The token path (GPM/SMAP) is unit-tested with mocked responses in the expected Hyrax
  DAP4 CSV / DAP2 ASCII formats. Its CMR lookup and OPeNDAP URLs were verified live up to the
  Earthdata Login redirect, but it hasn't run end to end without a real token.

## 2026-10-01: Interactive NASA map (Prompt 04)

| Topic | Decision | Why |
|---|---|---|
| Map engine | MapLibre GL (WebGL), lazy-loaded on `/map` only | Smooth fly-to and fades; open source, no token. ~300 KB gz stays out of the main bundle |
| Imagery | NASA GIBS WMTS (Blue Marble, MODIS yesterday, VIIRS Black Marble) | Real NASA pixels with no API key or account |
| Country outline | Bundled Natural Earth 1:10m (36 KB), generated by a script | Works offline; reproducible; no label/tile vendor needed |
| Labels | Division names as HTML markers | MapLibre text labels need a glyph server; 8 labels don't justify one |
| Risk grid | 0.2° synthetic surfaces anchored to farm scores | Honest demo data whose shape matches the future SMAP/GPM/MODIS grids |
| Layer switch | Cross-fade two fill layers + "satellite pass" sweep | MapLibre can't tween data-driven colors |
| URL state | `?layer=` and `?farm=` | Shareable views; dashboard "See on map" opens the farm on its worst risk |
| Tests | MapCanvas stubbed in jsdom (no WebGL); real map verified in dev and production builds | Page logic is fully tested; rendering checked in a real browser |

## 2026-10-01: Interactive dashboard (Prompt 03)

| Topic | Decision | Why |
|---|---|---|
| Data source | Backend serves the full dashboard from 3 sample farms | Frontend is built against the final API shape; Phase 4/5 swap the data, not the UI |
| Demo farms | Sunamganj haor (flood), Barind (drought), Bogura (calm) | Each tells a different climate story in a live demo |
| Overall score | `worst + 0.25 × mean(others)` | First formula (weighted blend) produced "Prepare now" while flood was "Act today". The overall message must never be calmer than the worst risk |
| Risk colors | Watch `#fde047`, Danger `#f43f5e` (was `#facc15`, `#f87171`) | Validator: old warning↔danger ΔE 10.6 (< 15, confusable). New set: normal-vision ΔE ≥ 17.7, CVD ≥ 8.2 |
| Badge text | Status color mixed 30% toward white | Raw danger-rose on its tint was 4.21:1; lifted text is 5.95:1 (WCAG AA) |
| Farm selection | URL `?farm=` | Shareable links, Back button works |
| Checklist state | `localStorage`, per farm, fail-safe | A farmer's ticks survive reloads; works in memory if storage is blocked |
| Page order | Overall + "What to do" first, details after | Farmer-first: condition and action before analysis |

## 2026-10-01: Animated design system (Prompt 02)

| Topic | Decision | Why |
|---|---|---|
| Visual theme | Dark "night field under the satellites" | Ties the NASA/space story to farming; colors glow nicely |
| Risk language | One 0–100 score → 4 levels (safe/watch/warning/danger) with color, EN/BN label, advice | Farmers learn one pattern and read every module the same way |
| Fonts | Self-hosted via `@fontsource-variable` | Demo must work without internet; Bengali needs Noto Sans Bengali |
| Class merging | `clsx` + `tailwind-merge`, extended with custom tokens | Safe overrides via `className` without dropping custom utilities |
| Illustrations | Hand-built SVG driven by data (health, moisture, rain, heat) | Turns numbers into pictures ("Your crop looks healthy") |
| Showcase | `/design` route, lazy-loaded | Visual QA for every component without bloating the farmer bundle |
| Scroll | `<ScrollRestoration />` in the layout | New pages open at the top; back restores position |

### Notes
- Links that look like buttons use `buttonStyles()` on `<Link>` (correct semantics), not `<Button onClick={navigate}>`.
- Toast auto-dismiss uses `setTimeout`, not animation callbacks, so it works in background tabs.

## 2026-09-30: Foundation defaults (Prompt 01)

| Topic | Decision | Why |
|---|---|---|
| Frontend | React 19 + Vite 8 + TypeScript | Fast dev loop, strong typing, huge ecosystem |
| Styling | Tailwind CSS v4 | Rapid, consistent styling with theme tokens |
| Animation | Framer Motion | Declarative springs and transitions for an "alive" UI |
| Icons | lucide-react | Friendly, consistent line icons |
| Routing | React Router 7 | Standard, supports nested layouts |
| Backend | Python + FastAPI | Python fits the NASA data and science tooling (xarray, rasterio) and gives auto API docs |
| Tests | pytest (API), Vitest + Testing Library (UI) | Fast, standard for each stack |
| Region | Bangladesh by default | Bengali support in the brief; flood and drought-prone agriculture |
| Data | Hybrid: `DATA_MODE=sample` now, `live` later | A demo that always works, plus a path to real NASA data (Earthdata token) |
| AI assistant | Claude API (Prompt 09) | Strong multilingual (Bengali) explanations |
| Dev orchestration | Root `npm run dev` via `concurrently` | One command for the whole stack, cross-platform |

### Notes
- The frontend retries the backend silently (5 × 1.5 s) before showing "offline",
  because Vite starts faster than uvicorn on a cold `npm run dev`.
- `httpx2` replaces `httpx` because Starlette's TestClient deprecated `httpx`.
