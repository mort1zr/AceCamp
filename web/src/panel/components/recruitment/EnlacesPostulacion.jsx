import { useEffect, useState } from 'react'
import { addDoc, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { applicationForms, publicApplicationPath } from '../../lib/publicApplications.js'
import { COLLECTIONS } from '../../lib/schema.js'

function Enlaces({ db, orgId }) {
  const [forms, setForms] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => onSnapshot(
    applicationForms(db, orgId),
    (snapshot) => setForms(snapshot.docs.map(({ id }) => id)),
    () => setError('No pudimos cargar los enlaces de postulación.'),
  ), [db, orgId])

  async function change(formId) {
    setBusy(true)
    setError('')
    const formsRef = applicationForms(db, orgId)
    try {
      if (formId) await deleteDoc(doc(formsRef, formId))
      else await addDoc(formsRef, { createdAt: serverTimestamp() })
    } catch {
      setError('No pudimos actualizar los enlaces. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-lg border border-line p-4" aria-label="Enlaces de postulación">
      <h2 className="font-semibold">Enlaces de postulación</h2>
      <p className="mb-2 text-sm">Comparte un enlace para recibir postulaciones sin cuenta.</p>
      <button type="button" className="players-button-secondary" disabled={busy || forms == null} onClick={() => change()}>Crear enlace</button>
      {forms?.length > 0 && (
        <ul className="mt-3 space-y-2">
          {forms.map((formId) => {
            const url = new URL(publicApplicationPath(orgId, formId), window.location.origin).href
            return (
              <li key={formId} className="flex flex-wrap items-center gap-2">
                <a className="break-all text-sm underline" href={url} target="_blank" rel="noopener">{url}</a>
                <button type="button" className="players-button-secondary" disabled={busy} onClick={() => change(formId)}>Desactivar</button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="players-field-error mt-2" role="alert">{error}</p>}
    </section>
  )
}

export default function EnlacesPostulacion({ db, orgId, uid, role }) {
  const [ownerId, setOwnerId] = useState(null)
  useEffect(() => {
    if (role === 'admin') return
    let active = true
    getDoc(doc(db, COLLECTIONS.orgs, orgId)).then(
      (org) => { if (active) setOwnerId(org.data()?.ownerId ?? null) },
      () => { if (active) setOwnerId(null) },
    )
    return () => { active = false }
  }, [db, orgId, role])
  return role === 'admin' || ownerId === uid ? <Enlaces db={db} orgId={orgId} /> : null
}
