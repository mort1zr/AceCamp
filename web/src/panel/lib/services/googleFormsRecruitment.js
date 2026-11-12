import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { googleFormApplicationId } from '../googleFormsApplications.js'
import { APPLICATION_CONSENT_VERSION, APPLICATION_STATUS, COLLECTIONS } from '../schema.js'

export async function importGoogleFormApplications(db, { orgId, uid, source, rows, signal }) {
  const result = { imported: 0, existing: 0, failed: [] }
  async function importRow(row) {
    try {
      const id = await googleFormApplicationId({ orgId, source, ...row })
      signal?.throwIfAborted()
      const reference = doc(db, COLLECTIONS.applications, id)
      return await runTransaction(db, async transaction => {
        const previous = await transaction.get(reference)
        signal?.throwIfAborted()
        if (previous.exists()) return 'existing'
        const now = serverTimestamp()
        transaction.set(reference, {
          orgId,
          source: 'google-forms',
          status: APPLICATION_STATUS.new,
          ...row.contact,
          consent: {
            accepted: true,
            version: APPLICATION_CONSENT_VERSION,
            method: row.contact.guardian ? 'guardian' : 'self',
            recordedBy: uid,
            recordedAt: now,
          },
          createdAt: now,
        })
        return 'imported'
      })
    } catch (error) {
      signal?.throwIfAborted()
      if (['permission-denied', 'unauthenticated'].includes(error.code)) return 'denied'
      return 'failed'
    }
  }

  for (let offset = 0; offset < rows.length; offset += 6) {
    signal?.throwIfAborted()
    const batch = rows.slice(offset, offset + 6)
    const outcomes = await Promise.all(batch.map(importRow))
    outcomes.forEach((outcome, index) => {
      if (outcome === 'imported' || outcome === 'existing') result[outcome]++
      else result.failed.push(batch[index].number)
    })
    if (outcomes.includes('denied')) {
      result.failed.push(...rows.slice(offset + batch.length).map(row => row.number))
      break
    }
  }
  return result
}
