import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { FieldValue } from 'firebase-admin/firestore'
import { APPLICATION_VIDEO_CONSENT_VERSION } from '../../src/panel/lib/schema.js'
import { MAX_VIDEO_FPS, MIN_VIDEO_FPS, videoRequirementsError } from '../../src/panel/lib/videoRequirements.js'
import { MAX_VIDEO_BYTES } from '../../src/panel/lib/videoUpload.js'

const route = /^\/api\/application-video\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9]{20})\/([A-Za-z0-9]{20})$/
const unavailable = 'La postulación o el enlace ya no está disponible.'
const uploadFailed = 'No pudimos adjuntar el video. Vuelve a intentarlo.'

class UploadError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function createApplicationVideoStore({ db, bucket }) {
  function references({ orgId, formId, applicationId }) {
    return [db.collection('applications').doc(applicationId),
      db.doc(`orgs/${orgId}/applicationForms/${formId}`)]
  }

  function authorized({ orgId, formId }, application, form) {
    const data = application.data()
    if (!form.exists || data?.orgId !== orgId || data.formId !== formId ||
        data.consent?.recordedBy !== 'public-form' || data.consent.version !== APPLICATION_VIDEO_CONSENT_VERSION) {
      throw new UploadError(403, unavailable)
    }
    return data
  }

  async function alreadyAttached(identity) {
    const [application, form] = await db.getAll(...references(identity))
    return authorized(identity, application, form).videoPaths?.length > 0
  }

  async function read({ orgId, formId, applicationId }) {
    const application = (await db.collection('applications').doc(applicationId).get()).data()
    const prefix = `orgs/${orgId}/applications/${applicationId}/video.`
    const path = application?.videoPaths?.[0]
    if (application?.orgId !== orgId || application.formId !== formId ||
        (path !== prefix + 'mp4' && path !== prefix + 'mov')) throw new UploadError(404, unavailable)
    const object = bucket.file(path)
    const [metadata] = await object.getMetadata()
    return { stream: object.createReadStream(), size: metadata.size,
      contentType: path.endsWith('.mov') ? 'video/quicktime' : 'video/mp4' }
  }

  async function attach(identity, { metadata, localPath, sha256, signal }) {
    const [applicationRef, formRef] = references(identity)
    const path = `orgs/${identity.orgId}/applications/${identity.applicationId}/video.${metadata.extension}`
    const receipt = { path, sha256 }
    const reserved = await db.runTransaction(async transaction => {
      const [application, form] = await transaction.getAll(applicationRef, formRef)
      const current = authorized(identity, application, form)
      if (current.videoPaths?.length > 0) return false
      if (current.videoUpload && (current.videoUpload.path !== path || current.videoUpload.sha256 !== sha256)) {
        throw new UploadError(409, 'Reintenta con el mismo archivo que empezaste a adjuntar.')
      }
      if (!current.videoUpload) transaction.update(applicationRef, { videoUpload: receipt })
      return true
    })
    if (!reserved) return

    const object = bucket.file(path)
    try {
      await pipeline(createReadStream(localPath), object.createWriteStream({
        resumable: false, validation: 'crc32c', preconditionOpts: { ifGenerationMatch: 0 },
        metadata: { contentType: metadata.contentType, cacheControl: 'private, no-store', metadata: { sha256 } },
      }), { signal })
    } catch (error) {
      if (Number(error.code) !== 412) throw error
      const [existing] = await object.getMetadata()
      if (existing.metadata?.sha256 !== sha256) throw error
    }

    // A retry can finish a reserved upload if the first request lost its connection.
    await db.runTransaction(async transaction => {
      const [application, form] = await transaction.getAll(applicationRef, formRef)
      const current = authorized(identity, application, form)
      if (current.videoPaths?.length > 0) return
      if (current.videoUpload?.path !== path || current.videoUpload.sha256 !== sha256) {
        throw new UploadError(409, uploadFailed)
      }
      transaction.update(applicationRef, { videoPaths: [path], videoUpload: FieldValue.delete() })
    })
  }

  return { alreadyAttached, attach, read }
}

export function createApplicationVideoMiddleware({ store, probe, authorize, origin }) {
  let uploading = false
  const host = new URL(origin).host
  return async (request, response, next) => {
    const match = route.exec(request.url ?? '')
    if (!match) return next()
    function reply(status, error) {
      if (!response.destroyed) response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      }).end(JSON.stringify(error ? { error } : { attached: true }))
      request.resume()
    }

    if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin)) return reply(403, unavailable)
    const [, orgId, formId, applicationId] = match
    const identity = { orgId, formId, applicationId }
    if (request.method === 'GET') {
      const bearerToken = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_.-]{1,8192})$/i)?.[1]
      if (!bearerToken) return reply(401, unavailable)
      const viewer = await authorize({ bearerToken }).catch(() => null)
      if (viewer?.orgId !== orgId) return reply(403, unavailable)
      try {
        const video = await store.read(identity)
        response.writeHead(200, { 'Content-Type': video.contentType, 'Content-Length': video.size,
          'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
        await pipeline(video.stream, response)
      } catch (error) {
        if (!response.headersSent) reply(error instanceof UploadError ? error.status : 503, unavailable)
        else response.destroy()
      }
      return
    }
    if (request.method !== 'POST') return reply(405, 'Usa POST para adjuntar el video.')
    if (request.headers.origin !== origin) return reply(403, unavailable)
    if (request.headers['content-type'] !== 'application/octet-stream' || request.headers['content-encoding']) {
      return reply(415, 'Usa un archivo MP4 o MOV.')
    }
    const length = Number(request.headers['content-length'])
    if (!Number.isSafeInteger(length) || length < 1) return reply(400, 'Selecciona un archivo de video válido.')
    if (length > MAX_VIDEO_BYTES) return reply(413, 'El video supera el máximo de 500 MB.')
    if (uploading) return reply(429, 'Hay otra carga en curso. Inténtalo de nuevo en unos segundos.')

    uploading = true
    const controller = new AbortController()
    response.once('close', () => { if (!response.writableEnded) controller.abort() })
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)])
    let directory
    let localPath
    try {
      if (await store.alreadyAttached(identity)) return reply(200)
      signal.throwIfAborted()
      directory = await mkdtemp(join(tmpdir(), 'acecam-application-video-'))
      localPath = join(directory, 'input')
      const hash = createHash('sha256')
      const count = new Transform({
        transform(chunk, _encoding, callback) {
          hash.update(chunk)
          callback(null, chunk)
        },
      })
      await pipeline(request, count, createWriteStream(localPath, { flags: 'wx' }), { signal })
      const metadata = await probe({ localPath, signal })
      const requirement = videoRequirementsError(metadata)
      if (requirement) return reply(422, requirement)
      if (!Number.isFinite(metadata.fps) || metadata.fps < MIN_VIDEO_FPS || metadata.fps > MAX_VIDEO_FPS) {
        return reply(422, `El video debe tener entre ${MIN_VIDEO_FPS} y ${MAX_VIDEO_FPS} FPS. Grábalo o expórtalo dentro de ese rango.`)
      }
      signal.throwIfAborted()
      await store.attach(identity, { metadata, localPath, sha256: hash.digest('hex'), signal })
      return reply(200)
    } catch (error) {
      if (error instanceof UploadError) return reply(error.status, error.message)
      if (error.code === 'import/format') return reply(415, 'No pudimos verificar el video. Usa otro MP4 o MOV.')
      return reply(503, uploadFailed)
    } finally {
      uploading = false
      if (localPath) await rm(localPath, { force: true }).catch(() => {})
      if (directory) await rmdir(directory).catch(() => {})
    }
  }
}
