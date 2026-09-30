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

### Dashboard data flow

`app/data/sample/farms.py` (3 demo farms) → `app/services/dashboard.py` (dates relative to
today, score = last trend value, level, 7-day change, priority sort) → `Dashboard` schema.
Phase 4/5 replace only the sample lookup; the schema stays the same.

`app/services/risk.py` holds the shared vocabulary:
- `score_to_level`: 0–24 safe · 25–49 watch · 50–74 warning · 75–100 danger (same as `frontend/src/lib/risk.ts`).
- `overall_score = worst + 0.25 × mean(others)`, capped at 100. The overall level is
  **never calmer than the worst module**, and several medium risks outrank a single one.

## Frontend (`frontend/src/`)

| Path | Responsibility |
|---|---|
| `app/` | App shell: providers (`MotionConfig`), router |
| `pages/` | Route-level screens that compose features |
| `features/<name>/` | Self-contained feature modules: components, hooks, tests |
| `components/ui/` | Design-system components (see below) |
| `components/illustrations/` | Data-driven SVG illustrations (Sun, RainCloud, Sprout, WaterDrop) |
| `components/layout/` | App shell: `AppLayout` (nav, page transitions, scroll restoration), `Starfield` |
| `lib/api.ts` | Typed API client, the only place that calls `fetch` |
| `lib/risk.ts` | 0–100 score → `safe / watch / warning / danger`, with EN + BN labels and advice |
| `lib/motion.ts` | Shared springs and variants (`fadeUp`, `pop`, `stagger`) |
| `lib/cn.ts` | `clsx` + `tailwind-merge`, aware of the custom tokens |
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
| `AnimatedNumber` | Counts up on scroll-in, springs to new values; `locale="bn-BD"` for Bengali numerals |
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
