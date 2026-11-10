import { useState } from 'react'
import PlayerForm from '../players/PlayerForm.jsx'
import { playersErrorMessage } from '../../lib/players.js'

function comparableName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export default function AsignarJugador({ application, roster, service, onCancel, onAssigned }) {
  const [playerId, setPlayerId] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const hasMatch = roster.rows.some((player) =>
    player.birthDate === application.birthDate && comparableName(player.fullName) === comparableName(application.fullName),
  )

  async function link(event) {
    event.preventDefault()
    if (!playerId || saving) return
    setSaving(true)
    setError('')
    try {
      onAssigned(await service.assignApplication(application.id, { playerId }))
    } catch (error) {
      setError(playersErrorMessage(error, 'update'))
    } finally {
      setSaving(false)
    }
  }

  if (creating && !hasMatch) {
    return <PlayerForm
      initialValues={application}
      service={{ create: (input) => service.assignApplication(application.id, { input }) }}
      onCancel={() => setCreating(false)}
      onCreated={onAssigned}
    />
  }

  return (
    <section className="players-form-panel" aria-label={`Jugador para ${application.fullName}`}>
      <h2 className="mb-3 font-semibold">Jugador para {application.fullName}</h2>
      {roster.loading && <p role="status">Consultando la plantilla…</p>}
      {roster.error && <p role="alert">{roster.error} <button type="button" className="underline" onClick={roster.retry}>Reintentar</button></p>}
      {!roster.loading && !roster.error && (
        <>
          {hasMatch && <p className="mb-2 text-sm">Ya hay una ficha con el mismo nombre y fecha de nacimiento. Vincúlala para evitar duplicados.</p>}
          {roster.rows.length > 0 && (
            <form className="players-field" onSubmit={link}>
              <label htmlFor="application-existing-player">Jugador existente</label>
              <select id="application-existing-player" value={playerId} disabled={saving} onChange={(e) => setPlayerId(e.target.value)}>
                <option value="">Selecciona una ficha</option>
                {roster.rows.map((player) => <option key={player.id} value={player.id}>{player.fullName} · {player.birthDate ?? 'Sin fecha'}</option>)}
              </select>
              <button type="submit" className="players-button-primary mt-2" disabled={!playerId || saving}>Vincular jugador</button>
            </form>
          )}
          {!hasMatch && <button type="button" className="players-button-secondary mt-2" disabled={saving} onClick={() => setCreating(true)}>Crear jugador nuevo</button>}
        </>
      )}
      <button type="button" className="players-button-secondary ml-2 mt-2" disabled={saving} onClick={onCancel}>Cancelar</button>
      {error && <p className="players-field-error" role="alert">{error}</p>}
    </section>
  )
}
