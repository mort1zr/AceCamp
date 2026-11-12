import { useEffect, useRef } from 'react'
import { DataTable } from '../ui'
import MatchNotes from './MatchNotes.jsx'
import MatchStatistics from './MatchStatistics.jsx'
import ProcessedVideo from './ProcessedVideo.jsx'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'

const setColumns = [
  { key: 'set', label: 'Set' },
  { key: 'playerGames', label: 'Jugador', align: 'right' },
  { key: 'opponentGames', label: 'Rival', align: 'right' },
]

export default function MatchReport({ match, playerName, notesService, videoService, onBack }) {
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
      <MatchStatistics match={match} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="font-semibold">Video procesado</h3>
          <ProcessedVideo matchId={match.id} path={match.processedVideoPath} service={videoService} />
        </section>
        <section className="rounded-card border border-line bg-surface p-5">
          {match.setScores?.length > 0 ? (
            <DataTable caption="Desglose por set" columns={setColumns} rows={match.setScores} rowKey="set" />
          ) : (
            <>
              <h3 className="font-semibold">Desglose por set</h3>
              <p className="mt-2 text-sm text-muted">Sin datos del desglose por set.</p>
            </>
          )}
        </section>
      </div>
      <MatchNotes matchId={match.id} service={notesService} />
    </section>
  )
}
