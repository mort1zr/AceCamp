// Comprueba que la Content-Security-Policy de firebase.json permite los <script> en línea
// del build (PCIT-169). Si alguien cambia el script del tema en index.html, su hash cambia
// y el navegador lo bloquearía en producción: este chequeo falla antes, en la CI.
// Uso (después de npm run build): npm run check:csp
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const firebase = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'))
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')

const csp = firebase.hosting.headers
  .flatMap(rule => rule.headers)
  .find(header => header.key === 'Content-Security-Policy')?.value
if (!csp) {
  console.error('firebase.json no define Content-Security-Policy en hosting.headers.')
  process.exit(1)
}
const scriptSrc = csp.split(';').map(part => part.trim()).find(part => part.startsWith('script-src ')) ?? ''

const missing = []
for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc=/.test(attrs)) continue
  const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`
  if (!scriptSrc.split(/\s+/).includes(hash)) missing.push(hash)
}

if (missing.length) {
  console.error(`La CSP de firebase.json no permite ${missing.length} script(s) en línea de dist/index.html.`)
  console.error(`Añade a script-src: ${missing.join(' ')}`)
  process.exit(1)
}
console.log('CSP: todos los scripts en línea están permitidos.')
