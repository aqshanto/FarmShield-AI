// Runs the FastAPI dev server and restarts it when backend code changes.
//
// Why not `uvicorn --reload`: on Windows its reloader restarts the worker by sending
// Ctrl+C, and Windows delivers that to every process in the console, which kills npm and
// `concurrently` ("Terminate batch job (Y/N)?") and the frontend with them on every
// backend edit. Here we watch the files ourselves and restart by ending the process tree,
// so no Ctrl+C is ever generated. Works the same on every OS.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, watch } from 'node:fs'
import { join, relative } from 'node:path'

const backend = join(import.meta.dirname, '..', 'backend')
const isWindows = process.platform === 'win32'
const python = isWindows ? join(backend, '.venv', 'Scripts', 'python.exe') : join(backend, '.venv', 'bin', 'python')

if (!existsSync(python)) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.')
  process.exit(1)
}

let child = null
let shuttingDown = false

function start() {
  child = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backend,
    stdio: 'inherit',
  })
  const current = child
  current.on('exit', (code) => {
    // Crashed on its own (e.g. a syntax error): wait for the next save to try again.
    if (current === child && !shuttingDown && code !== null && code !== 0) {
      console.log('[api-dev] API stopped with an error; fix the code and save to restart.')
    }
  })
}

function stop(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) return resolve()
    proc.once('exit', () => resolve())
    if (isWindows) spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' })
    else proc.kill('SIGTERM')
  })
}

let timer = null
let restarting = false
function scheduleRestart(file) {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    if (restarting || shuttingDown) return
    restarting = true
    console.log(`[api-dev] ${file} changed, restarting API…`)
    const previous = child
    child = null
    await stop(previous)
    start()
    restarting = false
  }, 300)
}

for (const dir of ['app']) {
  watch(join(backend, dir), { recursive: true }, (_event, filename) => {
    if (filename && filename.endsWith('.py')) scheduleRestart(relative(backend, join(backend, dir, filename)))
  })
}
if (existsSync(join(backend, '.env'))) {
  watch(join(backend, '.env'), () => scheduleRestart('.env'))
}

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  await stop(child)
  process.exit(0)
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, shutdown)

start()
