import { useEffect, useRef, useState } from 'react'
import { DataTable } from '../ui'
import { playerAge, playersErrorMessage } from '../../lib/players.js'

const sportFields = [
  ['Academia', 'academy'],
  ['Categoría', 'category'],
  ['Mano dominante', 'dominantHand'],
  ['Revés', 'backhand'],
  ['UTR', 'utr'],
  ['Ranking nacional', 'nationalRanking'],
  ['Entrenador en su academia', 'coachName'],
]

function dateLabel(value) {
  return typeof value === 'string' && value ? value.split('-').reverse().join('/') : 'Sin datos'
}

const matchColumns = [
  { key: 'matchDate', label: 'Fecha', render: dateLabel },
  { key: 'opponent', label: 'Rival' },
  { key: 'tournament', label: 'Torneo', render: value => value || '—' },
  { key: 'result', label: 'Resultado', render: value => value || '—' },
]

export default function PlayerProfile({ service, player, onBack }) {
  const { id, orgId, createdBy } = player
  const heading = useRef(null)
  const [history, setHistory] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => { heading.current?.focus() }, [])

  useEffect(() => {
    let active = true
    let stop
    const fail = error => {
      if (active) setHistory({ error: playersErrorMessage(error) })
    }
    try {
      stop = service.subscribeAnalyzedMatches({ id, orgId, createdBy }, rows => {
        if (active) setHistory({ rows })
      }, fail)
    } catch (error) {
      fail(error)
    }
    return () => { active = false; stop?.() }
  }, [service, id, orgId, createdBy, attempt])

  function retry() {
    setHistory(null)
    setAttempt(value => value + 1)
  }

  const age = playerAge(player.birthDate)

  return (
    <section className="players-page" aria-labelledby="player-profile-title">
      {service.mode === 'demo' && <aside className="players-demo-notice"><strong>Modo demostración</strong><span>Perfil de ejemplo.</span></aside>}
      <button type="button" className="players-button-secondary" onClick={onBack}>Volver a Jugadores</button>
      <header className="players-profile-heading">
        <p className="players-eyebrow">Perfil del jugador</p>
        <h1 id="player-profile-title" ref={heading} tabIndex={-1}>{player.fullName}</h1>
      </header>
      <div className="players-profile-grid">
        <section className="players-form-panel">
          <h2>Datos generales</h2>
          <dl>
            <div><dt>Fecha de nacimiento</dt><dd>{dateLabel(player.birthDate)}</dd></div>
            <div><dt>Edad</dt><dd>{age === null ? 'Sin datos' : `${age} años`}</dd></div>
            <div><dt>Nacionalidad</dt><dd>{player.nationality || 'Sin datos'}</dd></div>
            <div><dt>Año de graduación</dt><dd>{player.graduationYear ?? 'Sin datos'}</dd></div>
          </dl>
        </section>
        <section className="players-form-panel">
          <h2>Datos deportivos</h2>
          <dl>
            {sportFields.map(([label, key]) => (
              <div key={key}><dt>{label}</dt><dd>{(player[key] ?? '') === '' ? 'Sin datos' : player[key]}</dd></div>
            ))}
          </dl>
        </section>
      </div>
      <section className="players-profile-history">
        <h2>Partidos analizados</h2>
        <DataTable
          caption="Historial de partidos analizados"
          columns={matchColumns}
          rows={history?.rows}
          loading={history === null}
          error={history?.error}
          onRetry={retry}
          emptyTitle="Aún no hay partidos analizados"
          emptyDescription="Los partidos aparecerán aquí cuando termine el análisis."
        />
      </section>
    </section>
  )
}
