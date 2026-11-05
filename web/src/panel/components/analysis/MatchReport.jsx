import { useEffect, useRef } from 'react'
import { KpiCard } from '../ui'
import MatchNotes from './MatchNotes.jsx'
import { useUnidades } from '../../hooks/useUnidades.js'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function Speed({ label, value, units }) {
  return (
    <KpiCard
      label={label}
      value={value == null ? null : numberFormat.format(convertirVelocidad(value, units))}
      unit={etiquetaVelocidad(units)}
      description={value == null ? 'Sin datos' : undefined}
    />
  )
}

export default function MatchReport({ match, playerName, notesService, onBack }) {
  const units = useUnidades()
  const title = useRef(null)
  useEffect(() => { title.current?.focus() }, [])

  return (
    <section className="mt-5 flex flex-col gap-5" aria-labelledby="match-report-title">
      <button type="button" className="players-button-secondary self-start" onClick={onBack}>Volver al listado</button>
      <header className="rounded-card border border-line bg-surface p-5">
        <p className="players-eyebrow">Reporte del partido</p>
        <h2 id="match-report-title" ref={title} tabIndex={-1} className="font-display text-2xl font-bold">
          {playerName} · {match.opponent || 'Rival sin registrar'}
        </h2>
        <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
          <div><dt className="text-sm text-muted">Fecha</dt><dd>{formatMatchDate(match.matchDate)}</dd></div>
          <div><dt className="text-sm text-muted">Torneo</dt><dd>{match.tournament || 'Sin datos'}</dd></div>
          <div><dt className="text-sm text-muted">Marcador</dt><dd>{match.result || 'Sin datos'}</dd></div>
        </dl>
      </header>
      <section aria-labelledby="match-report-metrics">
        <h3 id="match-report-metrics" className="mb-3 font-semibold">Indicadores del jugador</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
          <KpiCard label="Golpes medidos" value={match.measuredShots} description={match.measuredShots == null ? 'Sin datos' : undefined} />
          <Speed label="Velocidad media de golpe" value={match.averageShotSpeed} units={units} />
          <Speed label="Velocidad máxima de golpe" value={match.maxShotSpeed} units={units} />
        </div>
      </section>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="font-semibold">Video procesado</h3>
          <p className="mt-2 text-sm text-muted">Video procesado no disponible.</p>
        </section>
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="font-semibold">Desglose por set</h3>
          <p className="mt-2 text-sm text-muted">Sin datos del desglose por set.</p>
        </section>
      </div>
      <MatchNotes matchId={match.id} service={notesService} />
    </section>
  )
}
