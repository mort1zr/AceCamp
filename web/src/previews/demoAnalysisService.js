import { analysisErrorMessage, normalizedMatch, throwIfAborted, validateAnalysis } from '../lib/analysis.js'

/** No uploads, downloads, worker, Firebase, or persistent data in this preview. */
export function createDemoAnalysisService({ playersService, maxBytes = 500 * 1024 * 1024, transferDelay = 250, supportsYouTube = true } = {}) {
  let rows = []
  const listeners = new Set()
  const emit = () => listeners.forEach(listener => listener(rows.map(row => ({ ...row }))))
  return {
    scopeKey: playersService.scopeKey,
    mode: 'demo', maxBytes, supportsLinks: true, supportsYouTube,
    createRequestId: () => crypto.randomUUID(),
    subscribe(onRows) {
      listeners.add(onRows)
      queueMicrotask(() => { if (listeners.has(onRows)) onRows(rows.map(row => ({ ...row }))) })
      return () => listeners.delete(onRows)
    },
    async enqueue(input, { requestId, signal, onProgress } = {}) {
      if (Object.keys(validateAnalysis(input, { maxBytes, supportsLinks: true, supportsYouTube })).length) throw Object.assign(new Error(analysisErrorMessage()), { code: 'analysis/validation' })
      const existing = rows.find(row => row.id === requestId)
      if (existing) return existing
      throwIfAborted(signal)
      for (const percent of [0, 25, 50, 75, 100]) {
        await new Promise(resolve => setTimeout(resolve, transferDelay))
        throwIfAborted(signal)
        onProgress?.({ phase: 'uploading', percent })
      }
      onProgress?.({ phase: 'saving', percent: 100 })
      const match = { ...normalizedMatch(input), id: requestId, status: 'en cola', videoPath: `demo/${requestId}`, createdAt: new Date().toISOString() }
      rows = [match, ...rows]
      emit()
      return match
    },
  }
}
