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
- Design system showcase: http://localhost:5173/design
- API: http://127.0.0.1:8000/api/v1/health
- API docs (Swagger): http://127.0.0.1:8000/docs

## Commands (run from the project root)

| Command | What it does |
|---|---|
| `npm run setup` | Creates `backend/.venv`, installs Python and npm dependencies |
| `npm run dev` | Starts backend (:8000) and frontend (:5173) together |
| `npm test` | Runs backend (pytest) and frontend (Vitest) tests |
| `npm run build` | Type-checks and builds the frontend into `frontend/dist` |
| `npm run lint` | Lints the frontend with oxlint |

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

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details, and
[PLAN.md](PLAN.md) / [DEVELOPMENT_PROMPTS.md](DEVELOPMENT_PROMPTS.md) for the roadmap.
