import { normalizeDashboardStatistics } from './dashboardOverview.js'
import { isValidBirthDate as isValidMatchDate } from './players.js'

export function formatMatchDate(date, short = false) {
  if (!isValidMatchDate(date)) return 'Fecha no disponible'
  const [year, month, day] = date.split('-')
  return short ? `${day}/${month}` : `${day}/${month}/${year}`
}

function chronological(a, b) {
  return a.date.localeCompare(b.date) || a.matchId.localeCompare(b.matchId)
}

/** Per-match observations; absent values remain null to preserve visible gaps. */
export function buildDashboardEvolution(matches, { orgId, playerId, decodeStatistics }) {
  if (!Array.isArray(matches) || !orgId || !playerId || typeof decodeStatistics !== 'function') throw new TypeError('Evolution requires rows, organization, player and a statistics decoder.')
  const seen = new Set()
  const points = []
  for (const match of matches) {
    if (!match || match.orgId !== orgId || match.playerId !== playerId || match.status !== 'listo' || typeof match.id !== 'string' || !match.id || seen.has(match.id)) continue
    seen.add(match.id)
    // Never replace a missing match date with an upload date or today's date.
    if (!isValidMatchDate(match.matchDate)) continue
    const decoded = decodeStatistics(match, { playerId })
    if (decoded && typeof decoded.then === 'function') throw new TypeError('Statistics decoder must be synchronous.')
    const statistics = normalizeDashboardStatistics(decoded, playerId)
    const speed = statistics?.serveSpeed
    const value = speed?.sampleCount > 0 ? speed.sumKmh / speed.sampleCount : null
    points.push({
      matchId: match.id, playerId, date: match.matchDate,
      opponent: typeof match.opponent === 'string' ? match.opponent : '',
      averageServeSpeed: typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null,
    })
  }
  return { playerId, points: points.sort(chronological) }
}

/** Defensive presentation boundary: do not display another player's old series. */
export function selectEvolutionPoints(evolution, playerId) {
  if (!evolution || evolution.playerId !== playerId || !Array.isArray(evolution.points)) return []
  const seen = new Set()
  return evolution.points.flatMap(point => {
    if (!point || point.playerId !== playerId || typeof point.matchId !== 'string' || !point.matchId || seen.has(point.matchId) || !isValidMatchDate(point.date)) return []
    seen.add(point.matchId)
    const value = point.averageServeSpeed
    return [{
      matchId: point.matchId, playerId, date: point.date,
      opponent: typeof point.opponent === 'string' ? point.opponent : '',
      averageServeSpeed: typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null,
    }]
  }).sort(chronological)
}
