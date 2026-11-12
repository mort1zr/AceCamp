// Versión del build publicada en el HTML (PCIT-198).
// En GitHub Actions es el commit (ACECAM_VERSION = github.sha, o GITHUB_SHA);
// fuera de la CI es "local". Sirve para saber qué versión está en
// https://acecam-e93a2.web.app y para comprobarla tras publicar (PCIT-199).

export const VERSION_META = 'acecam-version'

/** Devuelve una versión segura para poner en el HTML: letras, números, . _ - (máx. 64). */
export function buildVersion(env = process.env) {
  const candidata = String(env.ACECAM_VERSION || env.GITHUB_SHA || '').trim()
  return /^[0-9A-Za-z._-]{1,64}$/.test(candidata) ? candidata : 'local'
}

/** Plugin de Vite que agrega <meta name="acecam-version" content="…"> a cada página. */
export function versionPlugin(version = buildVersion()) {
  return {
    name: 'acecam-version',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: VERSION_META, content: version }, injectTo: 'head' },
    ],
  }
}

/** Lee la versión publicada de un HTML (la usa la comprobación tras publicar). */
export function readVersion(html) {
  const meta = String(html).match(/<meta\s+[^>]*name=["']acecam-version["'][^>]*>/i)?.[0]
  return meta?.match(/content=["']([^"']*)["']/i)?.[1] ?? null
}
