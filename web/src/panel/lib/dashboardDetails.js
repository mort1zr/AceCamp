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
  const attempts = sum(s => {
    const serve = s?.player?.serve
    return count(serve?.firstServeAttempts) && count(serve?.firstServeIn) && serve.firstServeIn <= serve.firstServeAttempts
      ? serve.firstServeAttempts : null
  })
  const secondIn = sum(s => {
    const serve = s?.player?.serve
    if (!count(serve?.firstServeAttempts) || !count(serve?.firstServeIn) || !count(serve?.doubleFaults)) return null
    const seconds = serve.firstServeAttempts - serve.firstServeIn
    return seconds >= 0 && serve.doubleFaults <= seconds ? seconds - serve.doubleFaults : null
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
  const averageSpeeds = stats.map(s => s?.player?.movement?.avgSpeedKmh)
  const heatmaps = stats.map(s => s?.player?.movement?.heatmap)
  const first = heatmaps[0]
  const heatmapValid = h => h && Number.isSafeInteger(h.columns) && Number.isSafeInteger(h.rows) && h.columns > 0 && h.rows > 0
    && Array.isArray(h.cells) && h.cells.length === h.columns * h.rows && h.cells.every(positive)
  const heatmap = heatmaps.length && heatmaps.every(h => heatmapValid(h) && h.columns === first.columns && h.rows === first.rows)
    ? { columns: first.columns, rows: first.rows, cells: first.cells.map((_, i) => heatmaps.reduce((n, h) => n + h.cells[i], 0)) }
    : null
  const shotMax = stats.map(s => s?.player?.shots?.maxSpeedKmh)
  const speedGroup = key => {
    const groups = stats.map(s => s?.player?.serve?.[key])
    const complete = groups.length > 0 && groups.every(g => count(g?.sampleCount) && positive(g?.sumSpeedKmh) && positive(g?.maxSpeedKmh))
    const samples = complete ? sum(s => s?.player?.serve?.[key]?.sampleCount) : null
    const total = complete ? groups.reduce((n, g) => n + g.sumSpeedKmh, 0) : null
    return {
      averageSpeedKmh: samples > 0 && Number.isFinite(total) ? total / samples : null,
      maxSpeedKmh: complete && groups.some(g => g.sampleCount > 0) ? Math.max(...groups.filter(g => g.sampleCount > 0).map(g => g.maxSpeedKmh)) : null,
    }
  }
  return {
    shots: { maxSpeedKmh: shotMax.length && shotMax.every(positive) ? Math.max(...shotMax) : null },
    serve: {
      attempts, firstIn, secondIn, doubleFaults: sum(s => s?.player?.serve?.doubleFaults),
      first: speedGroup('firstServe'), second: speedGroup('secondServe'),
    },
    rallies,
    movement: {
      distanceMeters: sum(s => s?.player?.movement?.distanceMeters, positive),
      distancePerMatch: (() => {
        const total = sum(s => s?.player?.movement?.distanceMeters, positive)
        return total != null && stats.length > 0 ? total / stats.length : null
      })(),
      averageSpeedKmh: averageSpeeds.length && averageSpeeds.every(positive) ? averageSpeeds.reduce((n, v) => n + v, 0) / averageSpeeds.length : null,
      heatmap,
      maxSpeedKmh: speeds.length && speeds.every(positive) ? Math.max(...speeds) : null,
    },
  }
}
