import { collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { analysisSignature, hashAnalysisSignature, normalizedMatch, throwIfAborted, validateAnalysis } from '../analysis.js'
import { limitError, nextUsage, planLimit, quotaReached, usageRef } from '../usage.js'
import { isStorageVideoPath } from '../videoImportProtocol.js'
import { planVigente } from '../planes.js'

export function checkQuota(org, counter) {
  // Una prueba vencida no tiene análisis (PCIT-170), igual que withinPlan en las reglas.
  const limit = planLimit(org.exists() ? planVigente(org.data()) : null)
  const used = counter.exists() ? counter.data().analyses : 0
  if (quotaReached(used, limit)) throw limitError(used, limit)
}

/** Adapters uploadVideo/importVideo return a Storage path, not a public URL. */
export function createFirestoreAnalysisService({ db, orgId, actorId, role = 'coach', uploadVideo, importVideo, maxBytes }) {
  if (!db || typeof orgId !== 'string' || !orgId.trim() || typeof actorId !== 'string' || !actorId.trim() || typeof uploadVideo !== 'function' || !Number.isFinite(maxBytes) || maxBytes <= 0) throw new Error('Analysis requires database, identity, uploadVideo and maxBytes.')
  const matches = collection(db, 'matches')
  const organization = doc(db, 'orgs', orgId)
  if (!['admin', 'coach'].includes(role)) throw new Error('Invalid analysis role.')
  const uploaded = new Map()
  const pending = new Map()
  const capabilities = { maxBytes, supportsLinks: typeof importVideo === 'function', supportsYouTube: typeof importVideo === 'function' && importVideo.supportsYouTube === true }

  async function enqueue(input, { requestId, onProgress, signal } = {}) {
    const errors = validateAnalysis(input, capabilities)
    if (Object.keys(errors).length) throw Object.assign(new Error('Invalid analysis'), { code: 'analysis/validation', fields: errors })
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(requestId ?? '')) throw new Error('Missing request ID')
    const signature = analysisSignature(input)
    const fingerprint = await hashAnalysisSignature(signature)
    throwIfAborted(signal)
    const reference = doc(matches, requestId)
    const existing = await getDoc(reference)
    if (existing.exists()) {
      const data = existing.data()
      if (data.orgId !== orgId || data.createdBy !== actorId || data.inputFingerprint !== fingerprint) throw new Error('Conflicting request')
      uploaded.delete(requestId)
      return { ...data, id: reference.id }
    }
    const player = await getDoc(doc(db, 'players', input.playerId))
    if (!player.exists() || player.data().deletedAt != null || player.data().orgId !== orgId || (role !== 'admin' && player.data().createdBy !== actorId)) throw Object.assign(new Error('Player not available'), { code: 'analysis/player' })
    // Antes de transferir el video: si el plan ya no tiene análisis este mes, no se sube nada (PCIT-41).
    const [org, counter] = await Promise.all([getDoc(organization), getDoc(usageRef(db, orgId))])
    checkQuota(org, counter)
    throwIfAborted(signal)

    let video = uploaded.get(requestId)
    if (video && video.signature !== signature) throw new Error('Conflicting request')
    if (!video) {
      onProgress?.({ phase: 'uploading', percent: 0 })
      const transfer = input.sourceType === 'file' ? uploadVideo : importVideo
      const videoPath = await transfer({
        ...(input.sourceType === 'file' ? { file: input.file } : { url: input.url.trim() }),
        orgId, actorId, matchId: requestId, maxBytes, signal,
        onProgress: value => { if (!signal?.aborted) onProgress?.({ phase: 'uploading', percent: Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0 }) },
      })
      const basePath = `orgs/${orgId}/matches/${requestId}/video`
      if (!isStorageVideoPath(videoPath) || (videoPath !== `${basePath}.mp4` && videoPath !== `${basePath}.mov`)) {
        throw Object.assign(new Error('Unexpected video path for match.'), { code: 'analysis/video-path' })
      }
      video = { signature, videoPath }
      uploaded.set(requestId, video)
    }
    throwIfAborted(signal)
    onProgress?.({ phase: 'saving', percent: 100 })
    const match = { ...normalizedMatch(input), orgId, createdBy: actorId, createdAt: serverTimestamp(), videoPath: video.videoPath, inputFingerprint: fingerprint, status: 'en cola' }
    const usage = usageRef(db, orgId)
    const saved = await runTransaction(db, async transaction => {
      const current = await transaction.get(reference)
      if (current.exists()) {
        const data = current.data()
        if (data.orgId !== orgId || data.createdBy !== actorId || data.inputFingerprint !== fingerprint) throw new Error('Conflicting request')
        return data
      }
      // El partido y el contador del mes se escriben juntos (PCIT-41).
      // Se vuelve a revisar el límite por si otro entrenador analizó mientras se subía el video.
      const counter = await transaction.get(usage)
      checkQuota(await transaction.get(organization), counter)
      transaction.set(reference, match)
      transaction.set(usage, nextUsage(counter.exists() ? counter.data() : null, reference.id, serverTimestamp()))
      return match
    })
    uploaded.delete(requestId)
    return { ...saved, id: reference.id }
  }

  return {
    scopeKey: `firestore:${db.app?.options?.projectId ?? ''}:${orgId}:${actorId}`,
    mode: 'live',
    ...capabilities,
    createRequestId: () => doc(matches).id,
    subscribe(onMatches, onError) {
      const filters = [where('orgId', '==', orgId)]
      if (role !== 'admin') filters.push(where('createdBy', '==', actorId))
      return onSnapshot(query(matches, ...filters), snapshot => {
        onMatches(snapshot.docs.map(item => ({ ...item.data(), id: item.id })).filter(row => row.orgId === orgId && (role === 'admin' || row.createdBy === actorId)).sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)))
      }, onError)
    },
    enqueue(input, options) {
      const errors = validateAnalysis(input, capabilities)
      if (Object.keys(errors).length) return Promise.reject(Object.assign(new Error('Invalid analysis'), { code: 'analysis/validation', fields: errors }))
      const id = options?.requestId
      const signature = analysisSignature(input)
      if (pending.has(id)) {
        const operation = pending.get(id)
        if (operation.signature !== signature) return Promise.reject(new Error('Conflicting request'))
        return operation.promise
      }
      const promise = enqueue(input, options).finally(() => pending.delete(id))
      pending.set(id, { signature, promise })
      return promise
    },
  }
}
