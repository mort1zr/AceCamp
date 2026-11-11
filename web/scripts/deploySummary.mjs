// Resumen del despliegue para la página del run de GitHub Actions (PCIT-200).
// Lee el resultado de cada paso desde variables de entorno y escribe una tabla
// en GITHUB_STEP_SUMMARY (o en la salida, si se corre a mano).
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ESTADOS = {
  success: '✅ Bien',
  failure: '❌ Falló',
  cancelled: '⏹️ Cancelado',
  skipped: '⏭️ No se ejecutó',
}
const estado = (outcome) => ESTADOS[outcome] ?? '⏭️ No se ejecutó'

export function deploySummary(env) {
  const produccion = env.EVENT_NAME !== 'pull_request'
  const url = produccion ? env.PRODUCTION_URL : env.PREVIEW_URL
  const version = env.VERSION ? `\`${env.VERSION.slice(0, 12)}\`` : '—'
  const filas = [
    ['Destino', produccion ? 'Producción (`main`)' : 'Vista previa de la PR'],
    ['URL', url ? `[${url}](${url})` : '—'],
    ['Versión (commit)', version],
    ['Publicar en Hosting', estado(env.HOSTING_OUTCOME)],
  ]
  if (produccion) {
    filas.push(
      ['Reglas e índices de Firestore', estado(env.RULES_OUTCOME)],
      ['Comprobación de la web en vivo', estado(env.CHECK_OUTCOME)],
      ['Reglas de Storage', env.DEPLOY_STORAGE_RULES === 'true'
        ? estado(env.RULES_OUTCOME)
        : '⏭️ Omitidas (requieren el plan Blaze; ver docs/devsecops.md)'],
    )
  }
  return ['### Despliegue de AceCam', '', '| Paso | Resultado |', '| --- | --- |',
    ...filas.map(([paso, resultado]) => `| ${paso} | ${resultado} |`), ''].join('\n')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const texto = deploySummary(process.env)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${texto}\n`)
  else console.log(texto)
}
