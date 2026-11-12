// Quién puede subir o leer un video en Azure Blob (PCIT-223, prueba de concepto de PCIT-222).
// Mismas condiciones que firebase/storage.rules (PCIT-24, PCIT-39, PCIT-161):
// - solo miembros (admin o coach) de la organización de la ruta;
// - el admin, cualquier partido de su organización; el coach, solo los que creó;
// - antes de crear el partido: sube cualquier miembro y lee solo quien lo subió;
// - processed.mp4 solo lo escribe el worker: aquí únicamente se lee.

const PATH = /^orgs\/([A-Za-z0-9_-]{1,128})\/matches\/([A-Za-z0-9_-]{1,128})\/(video\.mp4|video\.mov|processed\.mp4)$/

export const UPLOAD_TYPES = { 'video.mp4': 'video/mp4', 'video.mov': 'video/quicktime' }

export function parseVideoPath(path) {
  const match = typeof path === 'string' ? PATH.exec(path) : null
  return match ? { orgId: match[1], matchId: match[2], fileName: match[3] } : null
}

/**
 * @param {object} options
 * @param {import('firebase-admin/firestore').Firestore} options.db
 * @param {string} options.uid           UID verificado de Firebase Auth
 * @param {string} options.path          Ruta del blob dentro del contenedor
 * @param {'upload'|'read'} options.operation
 * @param {() => Promise<string|null>} options.uploadedBy  Autor guardado en el blob (solo si hace falta)
 */
export async function canAccessVideo({ db, uid, path, operation, uploadedBy }) {
  const target = parseVideoPath(path)
  if (!target || !uid || !['upload', 'read'].includes(operation)) return false
  if (operation === 'upload' && !(target.fileName in UPLOAD_TYPES)) return false

  const user = (await db.doc(`users/${uid}`).get()).data()
  if (!user || user.orgId !== target.orgId || !['admin', 'coach'].includes(user.role)) return false
  if (user.role === 'admin') return true

  const match = await db.doc(`matches/${target.matchId}`).get()
  if (match.exists) return match.get('orgId') === target.orgId && match.get('createdBy') === uid
  return operation === 'upload' || (await uploadedBy()) === uid
}
