// PCIT-43: estadísticas agregadas del contrato publicado por el worker.
const count = n => Number.isSafeInteger(n) && n >= 0
const positive = n => typeof n === 'number' && Number.isFinite(n) && n >= 0

export function buildDashboardDetails(matches, { orgId, playerId }) {
  const seen = new Set()
  const stats = matches.flatMap(match => {
    if (!match || match.orgId !== orgId || match.playerId !== playerId || match.status !== 'listo'
      || typeof match.id !== 'string' || !match.id || seen.has(match.id)) return []
    seen.add(match.id)
    return [match.statistics?.schemaVersion === 'acecam.match-stats.v1' ? match.statistics : null]
  })
  const sum = (get, valid = count) => {
    const values = stats.map(get)
    if (!values.length || !values.every(valid)) return null
    const result = values.reduce((total, n) => total + n, 0)
    return valid(result) ? result : null
  }
  const firstIn = sum(s => {
    const serve = s?.player?.serve
    return count(serve?.firstServeAttempts) && count(serve?.firstServeIn)
      && serve.firstServeIn <= serve.firstServeAttempts ? serve.firstServeIn : null
  })
  const validRallies = s => {
    const r = s?.rallies
    return r && ['count', 'sumShots', 'longestShots', 'short', 'medium', 'long'].every(key => count(r[key]))
      && r.short + r.medium + r.long === r.count && r.longestShots <= r.sumShots
      && (r.count > 0 || r.sumShots === 0) ? r : null
  }
  // Un gráfico puede usar el subconjunto conocido si declara su cobertura.
  // No interpreta los análisis antiguos sin distribución como cero peloteos.
  const distributions = stats.map(validRallies).filter(Boolean)
  const rallies = Object.fromEntries(['count', 'sumShots', 'short', 'medium', 'long'].map(key => {
    const total = distributions.reduce((n, r) => n + r[key], 0)
    return [key, distributions.length && count(total) ? total : null]
  }))
  rallies.coveredMatches = distributions.length
  rallies.totalMatches = stats.length
  rallies.averageShots = rallies.count > 0 && rallies.sumShots != null ? rallies.sumShots / rallies.count : null
  const longest = distributions.map(r => r.longestShots)
  rallies.longestShots = longest.length && longest.every(count) ? Math.max(...longest) : null
  const speeds = stats.map(s => s?.player?.movement?.maxSpeedKmh)
  return {
    serve: { firstIn, secondIn: null, doubleFaults: sum(s => s?.player?.serve?.doubleFaults) },
    rallies,
    movement: {
      distanceMeters: sum(s => s?.player?.movement?.distanceMeters, positive),
      maxSpeedKmh: speeds.length && speeds.every(positive) ? Math.max(...speeds) : null,
    },
  }
}
