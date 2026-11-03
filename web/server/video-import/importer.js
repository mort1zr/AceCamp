import { createHash } from 'node:crypto'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { validateLimit, VideoImportError } from './errors.js'

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)

async function removeTemporaryDirectory(directory, root) {
  if (!directory) return
  if (dirname(resolve(directory)) !== root || !basename(directory).startsWith('acecam-import-')) throw new Error('Invalid temporary cleanup target.')
  await rm(directory, { recursive: true, force: true })
}

function verifyReceipt(receipt, identity, sourceHash) {
  if (!receipt || receipt.orgId !== identity.orgId || receipt.actorId !== identity.actorId || receipt.matchId !== identity.matchId || receipt.sourceHash !== sourceHash || typeof receipt.videoPath !== 'string' || !receipt.videoPath || /(^\/|\\|:|(^|\/)\.\.?($|\/))/.test(receipt.videoPath)) throw new VideoImportError('conflict', 'Este intento no corresponde al video o a la sesión actuales.')
  return receipt.videoPath
}

/** Core only: auth, durable atomic Storage persistence and hosting remain explicit adapters. */
export function createVideoImporter({ authorize, store, download, probe, maxBytes, tempRoot = tmpdir(), maxConcurrent = 2 }) {
  validateLimit(maxBytes)
  if (typeof authorize !== 'function' || typeof store?.find !== 'function' || typeof store?.putIfAbsent !== 'function' || typeof download !== 'function' || typeof probe !== 'function' || !Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) throw new TypeError('Server auth, atomic storage, downloader and video probe are required.')
  let running = 0
  const pending = new Map()
  const root = resolve(tempRoot)

  return async function importVideo({ url, matchId, requestContext, signal, onProgress }) {
    signal?.throwIfAborted()
    let session
    try { session = await authorize(requestContext) }
    catch { throw new VideoImportError('permission', 'Tu sesión no permite importar este video.') }
    if (!validId(session?.orgId) || !validId(session?.actorId)) throw new VideoImportError('permission', 'Tu sesión no permite importar este video.')
    if (!validId(matchId) || typeof url !== 'string' || url.length > 4096) throw new VideoImportError('input', 'Revisa el enlace y el identificador del partido.')
    const identity = { orgId: session.orgId, actorId: session.actorId, matchId }
    const sourceHash = createHash('sha256').update(url.trim()).digest('hex')
    const key = `${identity.orgId}/${matchId}`
    const previous = pending.get(key)
    if (previous) throw new VideoImportError('busy', 'Este partido ya tiene una importación en curso. Espera y vuelve a intentarlo.')
    if (running >= maxConcurrent) throw new VideoImportError('busy', 'Hay otras importaciones en curso. Vuelve a intentarlo en unos momentos.')
    pending.set(key, true)
    running++
    let directory
    try {
      signal?.throwIfAborted()
      const existing = await store.find(identity)
      signal?.throwIfAborted()
      if (existing) return verifyReceipt(existing, identity, sourceHash)
      directory = await mkdtemp(join(root, 'acecam-import-'))
      const localPath = join(directory, 'video')
      const downloaded = await download({ url: url.trim(), destination: localPath, maxBytes, signal, onProgress })
      signal?.throwIfAborted()
      const file = await stat(localPath)
      if (!file.isFile() || file.size <= 0 || file.size > maxBytes || file.size !== downloaded.bytes || !/^[a-f0-9]{64}$/.test(downloaded.sha256)) throw new VideoImportError('size', 'La descarga del video no está completa o supera el límite.')
      const metadata = await probe({ localPath, signal })
      signal?.throwIfAborted()
      // putIfAbsent must handle cross-process races and return only durable, complete files.
      const receipt = await store.putIfAbsent({ ...identity, sourceHash, localPath, bytes: file.size, sha256: downloaded.sha256, metadata, signal })
      return verifyReceipt(receipt, identity, sourceHash)
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error instanceof VideoImportError) throw error
      throw new VideoImportError('failed', 'No pudimos importar el video. Conserva los datos y vuelve a intentarlo.')
    } finally {
      try { await removeTemporaryDirectory(directory, root) }
      finally { pending.delete(key); running-- }
    }
  }
}
