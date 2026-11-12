// Comprobación de la web en vivo después de publicar (PCIT-199).
// Uso: node scripts/checkDeploy.mjs <url> <versión esperada>
// Pide la URL y verifica que responde 200 y que <meta name="acecam-version">
// es el commit recién publicado. Reintenta unos segundos, por la caché del CDN.
// Termina con código 1 si la web no responde o sirve otra versión.
import { pathToFileURL } from 'node:url'
import { readVersion } from './buildVersion.mjs'

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function checkDeploy({ url, expected, attempts = 6, delayMs = 5000, fetchImpl = fetch }) {
  let last = { ok: false, status: null, version: null, error: null }
  for (let intento = 1; intento <= attempts; intento += 1) {
    try {
      // El parámetro evita que una caché intermedia devuelva el HTML anterior.
      const response = await fetchImpl(`${url}${url.includes('?') ? '&' : '?'}check=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      })
      const version = response.ok ? readVersion(await response.text()) : null
      last = { ok: response.ok && version === expected, status: response.status, version, error: null }
    } catch (error) {
      last = { ok: false, status: null, version: null, error: error.message }
    }
    if (last.ok) return { ...last, attempts: intento }
    if (intento < attempts) await esperar(delayMs)
  }
  return { ...last, attempts }
}

async function main([url, expected]) {
  if (!url || !expected) {
    console.error('Uso: node scripts/checkDeploy.mjs <url> <versión esperada>')
    return 2
  }
  const result = await checkDeploy({ url, expected })
  if (result.ok) {
    console.log(`La web en ${url} responde y sirve la versión ${expected} (intento ${result.attempts}).`)
    return 0
  }
  const motivo = result.error
    ? `no respondió (${result.error})`
    : result.status !== 200
      ? `respondió ${result.status}`
      : `sirve la versión ${result.version ?? 'desconocida'} en lugar de ${expected}`
  console.error(`::error::La web en ${url} ${motivo} tras ${result.attempts} intentos.`)
  return 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2))
}
