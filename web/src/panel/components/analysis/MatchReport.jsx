import { useCallback, useEffect, useRef, useState } from 'react'
import { DataTable } from '../ui'
import Marcador from '../players/Marcador.jsx'
import MovimientoCard from '../dashboard/MovimientoCard.jsx'
import PeloteosCard from '../dashboard/PeloteosCard.jsx'
import SaqueCard from '../dashboard/SaqueCard.jsx'
import MatchNotes from './MatchNotes.jsx'
import MatchStatistics from './MatchStatistics.jsx'
import ProcessedVideo from './ProcessedVideo.jsx'
import PdfPartido from '../pdf/PdfPartido.jsx'
import { BotonPdf } from '../pdf/ReportePdf.jsx'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'
import { resultadoDelPartido } from '../../lib/partido.js'

const setColumns = [
  { key: 'set', label: 'Set' },
  { key: 'playerGames', label: 'Jugador', align: 'right' },
  { key: 'opponentGames', label: 'Rival', align: 'right' },
]

export default function MatchReport({ match, playerName, notesService, videoService, organizacion, onBack }) {
  const title = useRef(null)
  const [exportando, setExportando] = useState(false)
  const terminarPdf = useCallback(() => setExportando(false), [])
  useEffect(() => { title.current?.focus() }, [])

  return (
    <section className="mt-5 flex flex-col gap-5" aria-labelledby="match-report-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="players-button-secondary" onClick={onBack}>Volver al listado</button>
        <BotonPdf onClick={() => setExportando(true)} disabled={exportando} />
      </div>
      {exportando && (
        <PdfPartido match={match} playerName={playerName} organizacion={organizacion} notesService={notesService} onTerminar={terminarPdf} />
      )}
      <header className="rounded-card border border-line bg-surface p-5">
        <p className="players-eyebrow">Reporte del partido</p>
        <h2 id="match-report-title" ref={title} tabIndex={-1} className="font-display text-3xl font-bold">
          {playerName} · {match.opponent || 'Rival sin registrar'}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {match.result ? <span className="text-xl"><Marcador value={match.result} /></span> : <span className="text-muted">Sin marcador</span>}
          {resultadoDelPartido(match.result) && (
            <span className={`rounded-full px-3 py-0.5 text-xs font-bold tracking-wider uppercase ${resultadoDelPartido(match.result) === 'gano' ? 'bg-accent text-bg' : 'border border-line text-muted'}`}>
              {resultadoDelPartido(match.result) === 'gano' ? 'Ganó' : 'Perdió'}
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
          <div><dt className="text-sm text-muted">Fecha</dt><dd>{formatMatchDate(match.matchDate)}</dd></div>
          <div><dt className="text-sm text-muted">Torneo</dt><dd>{match.tournament || 'Sin datos'}</dd></div>
        </dl>
      </header>
      <MatchStatistics match={match} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-4">
        <SaqueCard serve={match.details?.serve} playerId={match.playerId} />
        <PeloteosCard rallies={match.details?.rallies} playerId={match.playerId} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-4">
        <MovimientoCard movement={match.details?.movement} />
        <section className="flex flex-col rounded-card border border-line bg-surface p-5">
          <h3 className="font-semibold">Video procesado</h3>
          <ProcessedVideo matchId={match.id} path={match.processedVideoPath} service={videoService} />
        </section>
      </div>
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
      <MatchNotes matchId={match.id} service={notesService} />
    </section>
  )
}
