import { doc, getDocFromServer, runTransaction, serverTimestamp } from 'firebase/firestore'
import { COLLECTIONS, MATCH_NOTES } from '../schema.js'

function noteText(snapshot) {
  return snapshot.exists() ? snapshot.data().text : ''
}

export function createFirestoreMatchNotesService({ db, actorId }) {
  const reference = matchId => doc(db, COLLECTIONS.matches, matchId, MATCH_NOTES.collection, actorId)
  return {
    async load(matchId) {
      return noteText(await getDocFromServer(reference(matchId)))
    },
    async save(matchId, draft, expectedText) {
      const text = draft.trim()
      if (text.length > MATCH_NOTES.maxLength) throw new RangeError('La nota es demasiado larga.')
      const note = reference(matchId)
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(note)
        if (noteText(snapshot) !== expectedText) {
          throw Object.assign(new Error('La nota cambió.'), { code: 'notes/conflict' })
        }
        if (text) transaction.set(note, { text, updatedAt: serverTimestamp() })
        else if (snapshot.exists()) transaction.delete(note)
      })
      return text
    },
  }
}
