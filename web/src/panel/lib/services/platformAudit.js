import { collection, doc, getDocsFromServer, limit, orderBy, query, serverTimestamp } from 'firebase/firestore'

const entries = db => collection(db, 'platformAudit')

export async function loadPlatformAudit(db) {
  const result = await getDocsFromServer(query(entries(db), orderBy('createdAt', 'desc'), limit(100)))
  return result.docs.map(record => ({ ...record.data(), id: record.id }))
}

// En la misma transacción, el llamador guarda este ID como platformAuditId en la entidad.
export function recordPlatformChange(db, transaction, { actorId, entity, targetId, before, after }) {
  const reference = doc(entries(db))
  transaction.set(reference, { actorId, entity, targetId, before, after, createdAt: serverTimestamp() })
  return reference.id
}
