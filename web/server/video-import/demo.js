import { access } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { EMULATOR_PORTS, EMULATOR_PROJECT_ID } from '../../src/panel/lib/firebaseConfig.js'
import { createApplicationVideoMiddleware, createApplicationVideoStore } from './applicationVideo.js'
import { createDemoImportStore } from './demoStore.js'
import { createPublicVideoDownloader } from './download.js'
import { VideoImportError } from './errors.js'
import { createVideoImportHttpHandler } from './http.js'
import { createVideoImporter } from './importer.js'
import { createLocalVideoProbe } from './probe.js'
import { createVideoSourceDownloader, createYtDlpResolver } from './youtube.js'

const endpoint = '/api/video-import'
const emulatorEnvironment = {
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${EMULATOR_PORTS.auth}`,
  FIRESTORE_EMULATOR_HOST: `127.0.0.1:${EMULATOR_PORTS.firestore}`,
  FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${EMULATOR_PORTS.storage}`,
  STORAGE_EMULATOR_HOST: `http://127.0.0.1:${EMULATOR_PORTS.storage}`,
}

function readBody(request) {
  const chunks = request.iterator({ destroyOnReturn: false })
  return new ReadableStream({
    async pull(stream) {
      const { value, done } = await chunks.next()
      if (done) stream.close()
      else stream.enqueue(value)
    },
    cancel() {
      request.resume()
      return chunks.return()
    },
  })
}

export function demoVideoImport(env) {
  return {
    name: 'acecam-demo-video-import',
    async configureServer(server) {
      const { host, port, strictPort, https } = server.config.server
      if (host !== '127.0.0.1' || !port || !strictPort || https) {
        throw new Error('La demo de enlaces solo se sirve por HTTP en 127.0.0.1 con un puerto fijo.')
      }
      const { ACECAM_FFPROBE: ffprobe, ACECAM_YT_DLP: ytDlp } = env
      for (const [name, path] of [['ACECAM_FFPROBE', ffprobe], ['ACECAM_YT_DLP', ytDlp]]) {
        if (!path || !isAbsolute(path)) throw new Error(`Configura una ruta absoluta en ${name}.`)
        try { await access(path) } catch { throw new Error(`No se encontró el ejecutable de ${name}.`) }
      }
      for (const [name, value] of Object.entries(emulatorEnvironment)) {
        if (process.env[name] && process.env[name] !== value) throw new Error(`La demo solo permite el emulador local en ${name}.`)
      }
      Object.assign(process.env, emulatorEnvironment)

      // Vite can replace its HTTP server while keeping the same Node process.
      const app = getApps().find(instance => instance.name === 'acecam-import-demo') ?? initializeApp({
        projectId: EMULATOR_PROJECT_ID,
        storageBucket: EMULATOR_PROJECT_ID + '.appspot.com',
      }, 'acecam-import-demo')
      const db = getFirestore(app)
      const auth = getAuth(app)
      const origin = `http://${host}:${port}`
      const directDownload = createPublicVideoDownloader({ allowedHosts: ['raw.githubusercontent.com'] })
      const probe = createLocalVideoProbe({ executable: ffprobe })
      const bucket = getStorage(app).bucket()
      async function authorize({ bearerToken }) {
        const { uid } = await auth.verifyIdToken(bearerToken)
        const profile = (await db.collection('users').doc(uid).get()).data()
        if (!profile || !['coach', 'admin'].includes(profile.role)) return null
        return { orgId: profile.orgId, actorId: uid }
      }
      server.middlewares.use(createApplicationVideoMiddleware({
        origin, probe, authorize, store: createApplicationVideoStore({ db, bucket }),
      }))
      const importVideo = createVideoImporter({
        maxBytes: 24 * 1024 * 1024,
        maxConcurrent: 1,
        store: createDemoImportStore({ db, bucket }),
        download: createVideoSourceDownloader({ directDownload, resolveYouTube: createYtDlpResolver({ executable: ytDlp }) }),
        async probe(input) {
          const data = await probe(input)
          if (data.durationSeconds > 30) throw new VideoImportError('duration', 'La demo admite videos de hasta 30 segundos.')
          return data
        },
        authorize,
      })
      const handle = createVideoImportHttpHandler({ importVideo, origin })

      server.middlewares.use(async (request, response, next) => {
        if (request.url !== endpoint) return next()
        if (request.headers.host !== `${host}:${port}`) {
          response.writeHead(403).end()
          return
        }
        const controller = new AbortController()
        response.once('close', () => { if (!response.writableEnded) controller.abort() })
        try {
          const body = request.method === 'POST' ? readBody(request) : undefined
          const output = await handle(new Request(origin + endpoint, {
            method: request.method, headers: request.headers, signal: controller.signal,
            body, duplex: body ? 'half' : undefined,
          }))
          if (!response.destroyed) {
            const payload = await output.text()
            response.writeHead(output.status, Object.fromEntries(output.headers)).end(payload)
          }
        } catch {
          if (!response.destroyed) response.writeHead(500).end()
        }
      })
    },
  }
}
