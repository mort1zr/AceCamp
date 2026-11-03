/** Proposed adapter boundary, not an assertion about the worker's current JSON. */
export const DASHBOARD_STATISTICS_SCHEMA = 'acecam.player-match.v1'

const isCount = value => Number.isSafeInteger(value) && value >= 0
const isNonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function normalizeDashboardStatistics(value, playerId) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== DASHBOARD_STATISTICS_SCHEMA || value.playerId !== playerId) return null
  const rawSpeed = value.serveSpeed
  const serveSpeed = rawSpeed && isCount(rawSpeed.sampleCount) && isNonnegative(rawSpeed.sumKmh) && (rawSpeed.sampleCount !== 0 || rawSpeed.sumKmh === 0)
    ? { sampleCount: rawSpeed.sampleCount, sumKmh: rawSpeed.sumKmh } : null
  const rawFirst = value.firstServe
  const firstServe = rawFirst && isCount(rawFirst.attempts) && isCount(rawFirst.in) && rawFirst.in <= rawFirst.attempts
    ? { attempts: rawFirst.attempts, in: rawFirst.in } : null
  const doubleFaults = isCount(value.doubleFaults) ? value.doubleFaults : null
  if (!serveSpeed && !firstServe && doubleFaults == null) return null
  return { serveSpeed, firstServe, doubleFaults }
}

function safeCountSum(values) {
  const sum = values.reduce((total, value) => total + value, 0)
  return Number.isSafeInteger(sum) ? sum : null
}

/** Pure aggregation. A decoder must explicitly map the worker output to our contract. */
export function buildDashboardOverview(matches, { orgId, playerId, decodeStatistics }) {
  if (!Array.isArray(matches) || typeof orgId !== 'string' || !orgId || typeof playerId !== 'string' || !playerId || typeof decodeStatistics !== 'function') throw new TypeError('Dashboard requires rows, organization, player and a statistics decoder.')
  const seen = new Set()
  const valid = []
  let completedMatches = 0
  let incompatibleMatches = 0

  for (const match of matches) {
    if (!match || match.orgId !== orgId || match.playerId !== playerId || match.status !== 'listo' || typeof match.id !== 'string' || !match.id || seen.has(match.id)) continue
    seen.add(match.id)
    completedMatches += 1
    const decoded = decodeStatistics(match, { playerId })
    if (decoded && typeof decoded.then === 'function') throw new TypeError('Statistics decoder must be synchronous.')
    const statistics = normalizeDashboardStatistics(decoded, playerId)
    if (!statistics) { incompatibleMatches += 1; continue }
    valid.push(statistics)
  }

  // A metric is reported only if every included analysis supplies its counters.
  const speedComplete = valid.length > 0 && valid.every(item => item.serveSpeed != null)
  const firstComplete = valid.length > 0 && valid.every(item => item.firstServe != null)
  const faultsComplete = valid.length > 0 && valid.every(item => item.doubleFaults != null)
  const sampleCount = speedComplete ? safeCountSum(valid.map(item => item.serveSpeed.sampleCount)) : null
  const sumKmh = speedComplete ? valid.reduce((sum, item) => sum + item.serveSpeed.sumKmh, 0) : null
  const attempts = firstComplete ? safeCountSum(valid.map(item => item.firstServe.attempts)) : null
  const firstIn = firstComplete ? safeCountSum(valid.map(item => item.firstServe.in)) : null
  const faults = faultsComplete ? safeCountSum(valid.map(item => item.doubleFaults)) : null

  return {
    metrics: {
      analyzedMatches: valid.length,
      averageServeSpeed: sampleCount > 0 && Number.isFinite(sumKmh) ? sumKmh / sampleCount : null,
      firstServeInRate: attempts > 0 && firstIn != null ? firstIn / attempts * 100 : null,
      doubleFaults: faults,
    },
    coverage: { completedMatches, compatibleMatches: valid.length, incompatibleMatches },
  }
}
