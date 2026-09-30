// One-time setup: backend virtualenv + Python deps, then frontend npm deps.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const backend = join(root, 'backend')

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}  (in ${cwd})`)
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (!existsSync(join(backend, '.venv'))) {
  run(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'venv', '.venv'], backend)
}
run('node', [join(root, 'scripts', 'python.mjs'), '-m', 'pip', 'install', '-r', 'requirements-dev.txt'], root)
run('npm', ['install'], join(root, 'frontend'))

console.log('\nFarmShield AI is ready. Start it with: npm run dev')
