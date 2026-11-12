import { useEffect, useRef, useState } from 'react'
import { ErrorState, LoadingState } from '../ui'
import { MATCH_NOTES } from '../../lib/schema.js'

export default function MatchNotes({ matchId, service }) {
  const [saved, setSaved] = useState(null)
  const [draft, setDraft] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    service.load(matchId).then(text => {
      if (!active) return
      setSaved(text)
      setDraft(text)
    }, () => {
      if (active) setLoadFailed(true)
    })
    return () => { active = false }
  }, [matchId, service, attempt])

  async function save(event) {
    event.preventDefault()
    if (submitting.current || saved === null || draft.trim() === saved) return
    submitting.current = true
    setSaving(true)
    setStatus('')
    setError('')
    try {
      const text = await service.save(matchId, draft, saved)
      setSaved(text)
      setDraft(text)
      setStatus(text ? 'Nota guardada.' : 'Nota borrada.')
    } catch (failure) {
      setError(failure?.code === 'notes/conflict'
        ? 'La nota cambió en otra sesión. Copia tu borrador y vuelve a abrir el reporte para revisar la nota actual.'
        : 'No pudimos guardar la nota. Tu borrador sigue aquí.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-labelledby="match-notes-title">
      <h3 id="match-notes-title" className="text-sm font-semibold">Nota privada del entrenador</h3>
      <p className="mt-0.5 text-xs text-muted">Solo tu cuenta puede ver y editar esta nota en el panel.</p>
      {loadFailed ? (
        <ErrorState title="No pudimos cargar tu nota" onRetry={() => { setLoadFailed(false); setAttempt(value => value + 1) }} />
      ) : saved === null ? (
        <LoadingState title="Cargando tu nota…" />
      ) : (
        <form className="mt-3" aria-label="Guardar nota del partido" aria-busy={saving} onSubmit={save}>
          <label className="mb-1.5 block text-xs" htmlFor="match-note">Tu nota</label>
          <textarea
            id="match-note"
            className="block w-full resize-y rounded-lg border border-line bg-surface2 px-3 py-2 text-sm"
            rows={2}
            maxLength={MATCH_NOTES.maxLength}
            disabled={saving}
            value={draft}
            onChange={event => { setDraft(event.target.value); setStatus(''); setError('') }}
          />
          {error && <p className="players-field-error" role="alert">{error}</p>}
          {status && <p className="players-notice" role="status">{status}</p>}
          <button type="submit" className="players-button-primary mt-2 !min-h-9 !px-3 !py-1.5" disabled={saving || draft.trim() === saved}>
            {saving ? 'Guardando…' : 'Guardar nota'}
          </button>
        </form>
      )}
    </section>
  )
}
