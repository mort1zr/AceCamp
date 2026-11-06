// Comprueba que la Content-Security-Policy de firebase.json permite los <script> en línea
// del build (PCIT-169). Si alguien cambia el script del tema en index.html, su hash cambia
// y el navegador lo bloquearía en producción: este chequeo falla antes, en la CI.
// Uso (después de npm run build): npm run check:csp
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const firebase = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'))
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')

const csp = firebase.hosting.headers
  .flatMap(rule => rule.headers)
  .find(header => header.key === 'Content-Security-Policy')?.value
if (!csp) {
  console.error('firebase.json no define Content-Security-Policy en hosting.headers.')
  process.exit(1)
}
const allowed = (csp.split(';').map(part => part.trim()).find(part => part.startsWith('script-src ')) ?? '').split(/\s+/)

// Se usa un parser de HTML (no una expresión regular) para encontrar los scripts igual que el navegador.
const { document } = new JSDOM(html).window
const missing = []
for (const script of document.querySelectorAll('script:not([src])')) {
  const hash = `'sha256-${createHash('sha256').update(script.textContent).digest('base64')}'`
  if (!allowed.includes(hash)) missing.push(hash)
}

if (missing.length) {
  console.error(`La CSP de firebase.json no permite ${missing.length} script(s) en línea de dist/index.html.`)
  console.error(`Añade a script-src: ${missing.join(' ')}`)
  process.exit(1)
}
console.log('CSP: todos los scripts en línea están permitidos.')
