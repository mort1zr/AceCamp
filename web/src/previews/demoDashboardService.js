import { buildDashboardOverview } from '../lib/dashboardOverview.js'

const examples = {
  'example-1': { metrics: { analyzedMatches: 6, averageServeSpeed: 128.5, firstServeInRate: 62, doubleFaults: 0 } },
  'example-2': { metrics: { analyzedMatches: 3, averageServeSpeed: null, firstServeInRate: null, doubleFaults: 4 } },
  'example-3': { metrics: null },
}

const series = {
  'example-1': [['2026-08-18', 120], ['2026-09-02', 125], ['2026-09-16', 128], ['2026-10-01', 129], ['2026-10-15', 132], ['2026-10-29', 137]],
  'example-2': [['2026-09-20', 138.6], ['2026-10-10', null], ['2026-10-31', 143.8]],
}

function exampleEvolution(playerId, empty = false) {
  return { playerId, points: (empty ? [] : series[playerId] ?? []).map(([date, averageShotSpeed], index) => ({ matchId: `demo-${playerId}-${index}`, playerId, date, opponent: `Rival de ejemplo ${index + 1}`, averageShotSpeed })) }
}

/** Display fixtures only: no Firestore, aggregation or real statistics. */
export function createDemoDashboardService({ scopeKey, scenario = 'data' }) {
  return {
    scopeKey, mode: 'demo',
    subscribePlayer(playerId, onData, onError) {
      let active = true
      queueMicrotask(() => {
        if (!active || scenario === 'loading') return
        if (scenario === 'error') onError({ code: 'unavailable' })
        else if (scenario === 'unmapped') onData(buildDashboardOverview([
          { id: 'demo-unmapped', orgId: 'demo-org', playerId, status: 'listo', statistics: { player_1_average_shot_speed: 140 } },
        ], { orgId: 'demo-org', playerId, decodeStatistics: row => row.statistics }))
        else onData({ ...(scenario === 'empty' ? { metrics: null } : structuredClone(examples[playerId] ?? { metrics: null })), evolution: exampleEvolution(playerId, scenario === 'empty') })
      })
      return () => { active = false }
    },
  }
}
