// Runs the backend virtualenv's Python with the given args (works on Windows, macOS, Linux).
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const backend = join(import.meta.dirname, '..', 'backend')
const python = process.platform === 'win32'
  ? join(backend, '.venv', 'Scripts', 'python.exe')
  : join(backend, '.venv', 'bin', 'python')

if (!existsSync(python)) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.')
  process.exit(1)
}

const result = spawnSync(python, process.argv.slice(2), { cwd: backend, stdio: 'inherit' })
process.exit(result.status ?? 1)
