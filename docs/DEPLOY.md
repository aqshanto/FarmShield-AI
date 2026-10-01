# Deploying FarmShield AI

| Part | Host | Config in the repo |
|---|---|---|
| API (FastAPI, `backend/`) | [Render](https://render.com) | `render.yaml` (Blueprint) |
| Website (React, `frontend/`) | [Vercel](https://vercel.com) | `frontend/vercel.json` |

The website calls the API directly (`VITE_API_BASE_URL`), and the API only answers the
website's address (`CORS_ORIGINS`). Deploy the API first, because the website needs its URL.

## 0. Push the code to GitHub

Both hosts deploy from GitHub. Commit and push your work (secrets stay out: `.env` files are
git-ignored):

```bash
git add -A
```

```bash
git commit -m "Prepare deployment to Render and Vercel"
```

```bash
git push
```

## 1. API on Render

1. Sign in at render.com with GitHub. Choose **New → Blueprint** and pick the `FarmShield-AI` repository.
2. Render reads `render.yaml` and creates the **farmshield-api** web service (free plan, Python 3.14.3, root `backend`).
3. Fill in the secret values it asks for:

   | Variable | Value |
   |---|---|
   | `CORS_ORIGINS` | Leave as `http://localhost:5173` for now; you'll set the Vercel URL in step 3 |
   | `CORS_ORIGIN_REGEX` | Optional, for Vercel preview links, e.g. `https://farmshield-[a-z0-9-]+\.vercel\.app` |
   | `EARTHDATA_TOKEN` | Optional: your NASA Earthdata token (GPM and SMAP) |
   | `ANTHROPIC_API_KEY` | Optional: turns on Claude answers in the assistant |

4. Click **Apply**, then wait for the build to finish.
5. Open `https://<your-service>.onrender.com/api/v1/health`. It should show `"status":"ok"`.

Copy that base URL. If the name `farmshield-api` was taken, Render picks a different one.

**Without a Blueprint:** create **New → Web Service** from the repo with these settings:
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/v1/health`
- Environment variables: the ones listed in `render.yaml`, including `PYTHON_VERSION=3.14.3`

## 2. Website on Vercel

1. Sign in at vercel.com with GitHub. Choose **Add New → Project** and import `FarmShield-AI`.
2. Set **Root Directory** to `frontend`. Vercel detects Vite; `frontend/vercel.json` sets the build and SPA routing.
3. Under **Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<your-service>.onrender.com/api/v1` (no trailing slash) |

4. Click **Deploy** and copy your site URL, e.g. `https://farmshield-ai.vercel.app`.

`VITE_*` values are baked in at build time. After changing one, redeploy from the Vercel
dashboard (**Deployments → ⋯ → Redeploy**).

## 3. Connect them

On Render, open **farmshield-api → Environment** and set `CORS_ORIGINS` to your Vercel URL,
e.g. `https://farmshield-ai.vercel.app` (no trailing slash; comma-separate several), then
save. Render redeploys automatically.

## 4. Check it

- [ ] Home shows the three farm cards (they come from the API)
- [ ] `/dashboard`, `/map`, `/assistant` and `/data` open directly from the address bar
- [ ] The assistant answers, in Bengali too
- [ ] The browser console has no "CORS" errors

## Good to know

| Topic | Details |
|---|---|
| Free-plan sleep | Render's free API sleeps after 15 minutes idle. The first request then takes about a minute. Open the health URL a minute before you present, or use a paid instance. |
| NASA cache | The free disk is reset on every restart or deploy. The API re-downloads NASA data in the background (a few minutes); demo data fills in meanwhile. |
| Memory | The free plan has 512 MB. If the API restarts under load, set `DATA_MODE=sample` for a light, dramatic demo. |
| Every push redeploys | Both hosts rebuild on each push to `main`. Vercel also makes a preview URL for other branches; allow those with `CORS_ORIGIN_REGEX`. |
| CORS errors | `CORS_ORIGINS` must match the site address exactly: `https`, no trailing slash. |
