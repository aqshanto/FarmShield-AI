# FarmShield AI

NASA-powered climate intelligence for farmers. FarmShield AI turns satellite data
(SMAP, GPM, MODIS, VIIRS) into simple, visual flood, water-stress and crop-health
advice, in English and Bengali.

Built for the NASA Space Apps Challenge.

## Quick start

Requirements: **Node.js 20+** and **Python 3.11+**.

```bash
npm run setup
```

```bash
npm run dev
```

- App: http://localhost:5173
- Farm dashboard: http://localhost:5173/dashboard
- Risk map: http://localhost:5173/map
- Satellite data (pipeline): http://localhost:5173/data
- AI Farmer Assistant (English / বাংলা, voice): http://localhost:5173/assistant
- Flood report API: http://127.0.0.1:8000/api/v1/farms/sunamganj-haor/flood
- Water report API: http://127.0.0.1:8000/api/v1/farms/bogura-potato/water
- Crop report API: http://127.0.0.1:8000/api/v1/farms/bogura-potato/crop
- Design system showcase: http://localhost:5173/design
- API: http://127.0.0.1:8000/api/v1/health
- API docs (Swagger): http://127.0.0.1:8000/docs

## Commands (run from the project root)

| Command | What it does |
|---|---|
| `npm run setup` | Creates `backend/.venv`, installs Python and npm dependencies |
| `npm run dev` | Starts backend (:8000) and frontend (:5173) together |
| `npm run demo` | Same, with the bundled demo scenario (no NASA downloads; for presentations) |
| `npm test` | Runs backend (pytest) and frontend (Vitest) tests |
| `npm run build` | Type-checks and builds the frontend into `frontend/dist` |
| `npm run lint` | Lints the frontend with oxlint |

### NASA data pipeline

The API refreshes NASA data in the background on startup (cached, so restarts are
instant). You can also run it by hand, for example from a scheduled task. Run these
from `backend/` with the virtualenv's Python:

```bash
python -m app.pipeline refresh
```

```bash
python -m app.pipeline status
```

```bash
python -m pytest -m live
```

The last one runs the live smoke test against real NASA services.

**Optional:** add a free [NASA Earthdata](https://urs.earthdata.nasa.gov) token as
`EARTHDATA_TOKEN` in `backend/.env` to read GPM and SMAP directly. Without it, NASA POWER
stands in for rainfall and soil moisture.

### AI Farmer Assistant

Works out of the box with a built-in bilingual helper. For full conversations written by
Claude, add an Anthropic API key as `ANTHROPIC_API_KEY` in `backend/.env` (get one at
[console.anthropic.com](https://console.anthropic.com)) and restart `npm run dev`. From
`backend/`, this checks the key end to end:

```bash
python -m pytest -m live -k claude
```

Voice input and read-aloud use the browser's speech features (best in Chrome or Edge).
Reading Bengali aloud needs a Bengali voice installed on the device.

## Configuration

Copy the examples and edit as needed. Both files are optional in development.

- `backend/.env.example` → `backend/.env` (data mode, CORS, NASA Earthdata token, Claude API key)
- `frontend/.env.example` → `frontend/.env.local` (API base URL)

## Project layout

```
backend/     FastAPI service: API, NASA data pipeline, risk engines
frontend/    React + Vite app: animated farmer experience
docs/        Architecture and decision records
scripts/     Cross-platform setup and run helpers
```

Presenting? See [docs/DEMO.md](docs/DEMO.md) for the 5-minute script and checklist.

Deploying? See [docs/DEPLOY.md](docs/DEPLOY.md): API on Render (`render.yaml`), website on Vercel (`frontend/vercel.json`).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details, and
[PLAN.md](PLAN.md) / [DEVELOPMENT_PROMPTS.md](DEVELOPMENT_PROMPTS.md) for the roadmap.
