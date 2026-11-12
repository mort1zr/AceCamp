import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { APPLICATION_STATUS as STATUS, COLLECTIONS } from './schema.js'

const transitions = new Map([
  [STATUS.new, [STATUS.inReview]],
  [STATUS.inReview, [STATUS.analyzed]],
  [STATUS.analyzed, [STATUS.contacted, STATUS.discarded]],
  [STATUS.contacted, [STATUS.discarded]],
])

export function nextApplicationStates(status) {
  return transitions.get(status) ?? []
}

export function updateApplicationStatus(db, { uid, orgId }, { id, status }, nextStatus) {
  const application = doc(db, COLLECTIONS.applications, id)
  return runTransaction(db, async (transaction) => {
    const current = (await transaction.get(application)).data()
    if (current?.orgId !== orgId || current.status !== status) {
      throw new Error('application/status-conflict')
    }
    if (!nextApplicationStates(current.status).includes(nextStatus)) {
      throw new Error('application/status-transition')
    }
    transaction.update(application, { status: nextStatus, reviewedBy: uid, updatedAt: serverTimestamp() })
  })
}

export function updateApplicationNotes(db, { id }, internalNotes) {
  return updateDoc(doc(db, COLLECTIONS.applications, id), {
    internalNotes: String(internalNotes ?? '').slice(0, 2000),
    updatedAt: serverTimestamp(),
  })
}
