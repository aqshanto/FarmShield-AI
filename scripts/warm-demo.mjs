// Gets the API ready before a demo: wakes it (Render's free plan sleeps after ~15 idle
// minutes), then opens everything the demo will show, in English and Bengali, so nothing on
// stage is a first visit. NASA downloads, place names and the live map are then cached.
//
//   npm run warm                  the live API (Render)
//   npm run warm -- --local       the API on this laptop (npm run dev)
//   npm run warm -- --awake       then keep it awake: a tiny request every 10 minutes (Ctrl+C to stop)

const args = new Set(process.argv.slice(2))
const API = args.has('--local') ? 'http://localhost:8000/api/v1' : 'https://farmshield-api.onrender.com/api/v1'
const WAKE_TIMEOUT_MS = 4 * 60_000
const AWAKE_EVERY_MS = 10 * 60_000

// The world segment of docs/DEMO.md: the farm you get by searching "Giza" and choosing wheat
// (added below once the search answers), and a maize farm in the Kenya highlands.
const WORLD_FARMS = ['my_-1.0364_36.8431_maize']
const farmId = (lat, lon, crop) => `my_${lat.toFixed(4)}_${lon.toFixed(4)}_${crop}`
const SPOTS = [
  [-0.5, 37.0, 'maize'],
  [29.95, 31.25, 'wheat'],
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function get(path, timeoutMs = 90_000) {
  const started = Date.now()
  try {
    const response = await fetch(API + path, { signal: AbortSignal.timeout(timeoutMs) })
    const body = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, body, ms: Date.now() - started }
  } catch (error) {
    return { ok: false, status: error.name === 'TimeoutError' ? 'timeout' : 'offline', body: null, ms: Date.now() - started }
  }
}

function report(label, result, detail = '') {
  const mark = result.ok ? '✓' : '✗'
  const time = `${(result.ms / 1000).toFixed(1)}s`.padStart(6)
  console.log(`  ${mark} ${label.padEnd(34)} ${time}  ${result.ok ? detail : `(${result.status})`}`)
  return result.ok
}

async function wake() {
  console.log(`Waking ${API.replace('/api/v1', '')} …`)
  const deadline = Date.now() + WAKE_TIMEOUT_MS
  while (Date.now() < deadline) {
    const health = await get('/health', 30_000)
    if (health.ok) {
      console.log(`  ✓ up (${health.body?.data_mode ?? '?'} mode)\n`)
      return health.body
    }
    await sleep(5000)
  }
  console.error('  ✗ The API did not wake up within 4 minutes. Check the Render dashboard.')
  process.exit(1)
}

async function warm(mode) {
  let good = true
  console.log('Map')
  // The first map visit may answer "warming" while the live grid builds; wait for it.
  for (let i = 0; i < 12; i++) {
    const map = await get('/map/overview')
    const status = map.body?.grid_status ?? ''
    if (!map.ok || status !== 'warming') {
      good = report('Risk map', map, status) && good
      break
    }
    await sleep(10_000)
  }
  good = report('Risk map (Bengali)', await get('/map/overview?lang=bn')) && good

  console.log('Demo farms')
  const farms = await get('/farms')
  for (const farm of farms.body ?? []) {
    const d = await get(`/farms/${farm.id}/dashboard`)
    good = report(farm.name, d, d.body ? `${d.body.overall.level}` : '') && good
    good = report(`${farm.name} (Bengali)`, await get(`/farms/${farm.id}/dashboard?lang=bn`)) && good
  }

  if (mode !== 'live') {
    console.log('\nThe API runs the demo scenario: farms anywhere and spot checks need live mode. Skipping the world segment.')
    return good
  }

  console.log('World segment')
  const giza = await get('/places/search?q=Giza')
  good = report('Place search "Giza"', giza, giza.body ? `${giza.body.length} found` : '') && good
  const first = giza.body?.[0]
  if (first) WORLD_FARMS.unshift(farmId(first.lat, first.lon, 'wheat'))
  for (const id of WORLD_FARMS) {
    const d = await get(`/farms/${id}/dashboard`)
    const where = d.body ? `${d.body.farm.district}, ${d.body.farm.division} · ${d.body.overall.level}` : ''
    good = report(`Farm ${id.slice(3)}`, d, where) && good
    good = report('  … in Bengali', await get(`/farms/${id}/dashboard?lang=bn`)) && good
  }
  for (const [lat, lon, crop] of SPOTS) {
    const p = await get(`/map/point?lat=${lat}&lon=${lon}&crop=${crop}`)
    good = report(`Spot check ${lat}, ${lon}`, p, p.body ? `${p.body.place ?? '?'}, ${p.body.country ?? '?'}` : '') && good
  }
  for (const q of ['Kiambu']) {
    const s = await get(`/places/search?q=${q}`)
    good = report(`Place search "${q}"`, s, s.body ? `${s.body.length} found` : '') && good
  }
  return good
}

const health = await wake()
const good = await warm(health.data_mode)
console.log(good ? '\nReady for the demo.' : '\nSome checks failed (✗). Run again in a minute; most failures are first-time downloads.')

if (args.has('--awake')) {
  console.log(`Keeping the API awake: a request every ${AWAKE_EVERY_MS / 60_000} minutes. Ctrl+C to stop.`)
  for (;;) {
    await sleep(AWAKE_EVERY_MS)
    const ping = await get('/health', 60_000)
    console.log(`  ${new Date().toLocaleTimeString()} ${ping.ok ? '✓ awake' : `✗ ${ping.status}`}`)
  }
}
process.exit(good ? 0 : 1)
