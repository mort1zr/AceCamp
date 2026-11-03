const examples = {
  'example-1': { metrics: { analyzedMatches: 6, averageServeSpeed: 128.5, firstServeInRate: 62, doubleFaults: 0 } },
  'example-2': { metrics: { analyzedMatches: 3, averageServeSpeed: 141.2, firstServeInRate: null, doubleFaults: 4 } },
  'example-3': { metrics: null },
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
        else onData(scenario === 'empty' ? { metrics: null } : structuredClone(examples[playerId] ?? { metrics: null }))
      })
      return () => { active = false }
    },
  }
}
