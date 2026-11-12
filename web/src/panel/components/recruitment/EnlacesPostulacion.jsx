import { useEffect, useState } from 'react'
import { addDoc, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { applicationForms, publicApplicationPath } from '../../lib/publicApplications.js'
import { COLLECTIONS } from '../../lib/schema.js'
import './bandeja.css'

function Enlaces({ db, orgId }) {
  const [forms, setForms] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // PCIT-184: qué enlace se copió (para el aviso) o si el navegador no dejó copiar.
  const [copiado, setCopiado] = useState(null)
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

  async function copiar(formId, url) {
    setError('')
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(formId)
    } catch {
      setCopiado(null)
      setError('No pudimos copiar el enlace. Selecciónalo y cópialo a mano.')
    }
  }

  return (
    <section className="rec-enlace" aria-label="Enlaces de postulación">
      <p className="rec-etiqueta">Tu formulario de postulación</p>
      {forms?.length > 0 ? (
        <ul>
          {forms.map((formId, index) => {
            const url = new URL(publicApplicationPath(orgId, formId), window.location.origin).href
            return (
              <li key={formId}>
                <div className="rec-url-caja">
                  <a className="rec-url" href={url} title={url} target="_blank" rel="noopener">{new URL(url).host}{publicApplicationPath(orgId, formId)}</a>
                  <button type="button" className="rec-copiar" aria-label={copiado === formId ? 'Enlace copiado' : 'Copiar enlace'} title={copiado === formId ? 'Copiado' : 'Copiar enlace'} onClick={() => copiar(formId, url)}>
                    {copiado === formId ? (
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    ) : (
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>
                    )}
                  </button>
                </div>
                <button type="button" className="players-button-secondary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Vista previa</button>
                <button type="button" className="players-button-secondary" disabled={busy} onClick={() => change(formId)}>Desactivar</button>
                {index === forms.length - 1 && (
                  <button type="button" className="players-button-secondary" disabled={busy || forms == null} onClick={() => change()}>Crear enlace</button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <>
          <p className="rec-nota">Comparte un enlace para recibir postulaciones sin cuenta.</p>
          <button type="button" className="players-button-secondary rec-crear" disabled={busy || forms == null} onClick={() => change()}>Crear enlace</button>
        </>
      )}
      {error && <p className="players-field-error" role="alert">{error}</p>}
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
