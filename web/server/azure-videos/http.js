// API de enlaces temporales para videos en Azure Blob (PCIT-223, prueba de concepto).
// POST /api/videos/sign  { path, operation: 'upload' | 'read' }  con  Authorization: Bearer <ID token de Firebase>
//   200 { url, expiresOn } · 400 datos inválidos · 401 sin sesión · 403 sin permiso
// Web Request -> Response, como server/video-import/http.js.

import { UPLOAD_TYPES, canAccessVideo, parseVideoPath } from './access.js'

const MINUTES = { upload: 15, read: 10 }
const PERMISSIONS = { upload: 'cw', read: 'r' }

export function createAzureVideoHandler({ verifyIdToken, db, signer, origin, maxBodyBytes = 2048 }) {
  const allowed = new URL(origin).origin
  if (allowed !== origin || typeof verifyIdToken !== 'function' || !db || !signer) {
    throw new TypeError('Hacen falta verifyIdToken, Firestore, el firmante y el origen exacto de la web.')
  }
  const cors = {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  const reply = (status, body) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...cors },
  })

  return async function handle(request) {
    if (request.headers.has('origin') && request.headers.get('origin') !== allowed) return reply(403, { error: 'origen' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/videos/sign') return reply(404, { error: 'ruta' })

    const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_.-]{1,8192})$/)?.[1]
    if (!token) return reply(401, { error: 'sesion' })
    let uid
    try {
      uid = (await verifyIdToken(token)).uid
    } catch {
      return reply(401, { error: 'sesion' })
    }

    let input
    try {
      const text = await request.text()
      if (text.length > maxBodyBytes) return reply(413, { error: 'tamano' })
      input = JSON.parse(text)
    } catch {
      return reply(400, { error: 'datos' })
    }
    const { path, operation } = input ?? {}
    if (!parseVideoPath(path) || !(operation in MINUTES) || Object.keys(input).some(key => !['path', 'operation'].includes(key))) {
      return reply(400, { error: 'datos' })
    }

    const allowedAccess = await canAccessVideo({ db, uid, path, operation, uploadedBy: () => signer.uploadedBy(path) })
    if (!allowedAccess) return reply(403, { error: 'permiso' })

    const signed = await signer.sign(path, { permissions: PERMISSIONS[operation], minutes: MINUTES[operation] })
    // Al subir, la web debe enviar estos encabezados con el PUT.
    const headers = operation === 'upload'
      ? { 'x-ms-blob-type': 'BlockBlob', 'x-ms-blob-content-type': UPLOAD_TYPES[parseVideoPath(path).fileName], 'x-ms-meta-uploadedby': uid }
      : undefined
    return reply(200, { ...signed, ...(headers ? { headers } : {}) })
  }
}
