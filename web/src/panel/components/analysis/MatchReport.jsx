import { useCallback, useEffect, useRef, useState } from 'react'
import { KpiCard as BaseKpiCard } from '../ui'
import MatchNotes from './MatchNotes.jsx'
import ProcessedVideo from './ProcessedVideo.jsx'
import PdfPartido from '../pdf/PdfPartido.jsx'
import { BotonPdf } from '../pdf/ReportePdf.jsx'
import { useUnidades } from '../../hooks/useUnidades.js'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function KpiCard({ value, description, ...props }) {
  return <BaseKpiCard {...props} value={value} description={value == null ? 'Sin datos' : description} />
}

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

export default function MatchReport({ match, playerName, notesService, videoService, organizacion, onBack }) {
  const units = useUnidades()
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
          <KpiCard label="Golpes medidos" value={match.measuredShots} description={match.measuredShots == null ? 'Sin datos' : 'Golpes con velocidad medible; puede ser menor que el total de golpes.'} />
          <Speed label="Velocidad media de golpe" value={match.averageShotSpeed} units={units} />
          <Speed label="Velocidad máxima de golpe" value={match.maxShotSpeed} units={units} />
        </div>
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
          <KpiCard label="Distancia recorrida" value={match.distanceMeters == null ? null : numberFormat.format(match.distanceMeters)} unit="m" />
          <Speed label="Velocidad media de desplazamiento" value={match.avgMovementSpeed} units={units} />
          <Speed label="Velocidad máxima de desplazamiento" value={match.maxMovementSpeed} units={units} />
          <KpiCard label="Saques detectados" value={match.serveCount} />
          <Speed label="Velocidad media de saque" value={match.averageServeSpeed} units={units} />
          <KpiCard label="Primer saque dentro" value={match.firstServeInRate == null ? null : numberFormat.format(match.firstServeInRate)} unit="%" />
          <KpiCard label="Dobles faltas" value={match.doubleFaults} />
        </div>
        <p className="mt-3 text-sm text-muted">Las medidas son estimaciones del modelo. La velocidad de saque se mide hasta el bote y puede diferir de la de un radar.</p>
      </section>
      <section aria-labelledby="match-rallies">
        <h3 id="match-rallies" className="mb-3 font-semibold">Peloteos del partido</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
          <KpiCard label="Peloteos detectados" value={match.ralliesCount} />
          <KpiCard label="Golpes por peloteo" value={match.averageRallyShots == null ? null : numberFormat.format(match.averageRallyShots)} />
          <KpiCard label="Peloteo más largo" value={match.longestRally} unit="golpes" />
        </div>
      </section>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="font-semibold">Video procesado</h3>
          <ProcessedVideo matchId={match.id} path={match.processedVideoPath} service={videoService} />
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
