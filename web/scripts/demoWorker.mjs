import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { EMULATOR_PORTS, EMULATOR_PROJECT_ID } from '../src/panel/lib/firebaseConfig.js'

const [directory, option] = process.argv.slice(2)
if (!directory || (option && option !== '--once') || process.argv.length > 4) {
  throw new Error('Uso: npm run demo:worker -- ruta/al/model [--once]')
}

const cwd = resolve(directory)
await access(join(cwd, 'worker', '__main__.py'))
const args = ['-u', '-m', 'worker', '--project', EMULATOR_PROJECT_ID,
  '--bucket', EMULATOR_PROJECT_ID + '.appspot.com']
if (option) args.push(option)
const child = spawn(process.env.ACECAM_PYTHON || 'python', args, {
  cwd,
  stdio: 'inherit',
  env: {
    ...process.env,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${EMULATOR_PORTS.firestore}`,
    STORAGE_EMULATOR_HOST: `http://127.0.0.1:${EMULATOR_PORTS.storage}`,
    YOLO_OFFLINE: 'true',
  },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal))
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
