import { useMemo, useState } from 'react'
import { useAnalysisQueue } from '../../hooks/useAnalysisQueue.js'
import { useUnidades } from '../../hooks/useUnidades.js'
import { analysisErrorMessage } from '../../lib/analysis.js'
import { MATCH_STATUS } from '../../lib/schema.js'
import { createApplicationAnalysisService } from '../../lib/services/applicationAnalysis.js'
import { reportMetrics } from '../../lib/services/firestoreMatchesService.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import { StatusBadge } from '../ui'

const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function Resultado({ match }) {
  const units = useUnidades()
  const metrics = reportMetrics(match)
  const duration = match.statistics?.durationSeconds
  const speed = (value) => value == null ? 'Sin datos' : `${number.format(convertirVelocidad(value, units))} ${etiquetaVelocidad(units)}`
  const values = [
    ['Video analizado', Number.isFinite(duration) && duration >= 0 ? `${number.format(duration)} s` : 'Sin datos'],
    ['Golpes medidos', metrics.measuredShots ?? 'Sin datos'],
    ['Velocidad media de golpe', speed(metrics.averageShotSpeed)],
    ['Velocidad máxima de golpe', speed(metrics.maxShotSpeed)],
    ['Distancia recorrida', metrics.distanceMeters == null ? 'Sin datos' : `${number.format(metrics.distanceMeters)} m`],
  ]
  return (
    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
      {values.map(([label, value]) => <div key={label}><dt className="text-sm text-muted">{label}</dt><dd>{value}</dd></div>)}
    </dl>
  )
}

function Video({ index, path, match, service, canAnalyze }) {
  const [position, setPosition] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (saving || !canAnalyze) return
    setSaving(true)
    setError('')
    try {
      if (match?.status === MATCH_STATUS.error) await service.retry(match.id)
      else await service.enqueue(path, position)
    } catch (failure) {
      setError(failure.code ? analysisErrorMessage(failure) : failure.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-3 rounded-lg border border-line p-3">
      <h3 className="mb-2 font-semibold">Video {index + 1}</h3>
      {match && <StatusBadge status={match.status} />}
      {match?.status === MATCH_STATUS.ready && <Resultado match={match} />}
      {match?.status === MATCH_STATUS.error && <p className="my-2 text-sm" role="alert">
        {match.errorMessage || 'No se pudo analizar el video.'}
      </p>}
      {canAnalyze && (!match || match.status === MATCH_STATUS.error) && (
        <form onSubmit={submit} className="players-field mt-2">
          {!match && (
            <label>
              Posición del postulante en el video {index + 1}
              <select required value={position} onChange={(event) => setPosition(event.target.value)} disabled={saving}>
                <option value="">Elige una posición</option>
                <option value="arriba">Arriba de la cancha</option>
                <option value="abajo">Abajo de la cancha</option>
              </select>
            </label>
          )}
          <button type="submit" className="players-button-primary mt-2" disabled={saving || (!match && !position)}>
            {saving ? 'Guardando…' : match ? 'Reintentar' : 'Analizar video'}
          </button>
        </form>
      )}
      {error && <p role="alert" className="players-field-error mt-2">{error}</p>}
    </section>
  )
}

export default function AnalisisPostulacion({ db, orgId, uid, role, application, canAnalyze, onBack }) {
  const applicationId = application.id
  const service = useMemo(() => createApplicationAnalysisService({ db, orgId, uid, role, applicationId }),
    [db, orgId, uid, role, applicationId])
  const queue = useAnalysisQueue(service)
  return (
    <section className="players-form-panel" aria-label={`Videos de ${application.fullName}`}>
      <button className="players-button-secondary mb-3" type="button" onClick={onBack}>Volver a la bandeja</button>
      <h2 className="font-semibold">Videos de {application.fullName}</h2>
      {application.videoPaths.length > 0 && !canAnalyze && <p>Vincula una ficha disponible para tu sesión antes de analizar el video.</p>}
      {queue.loading && <p role="status">Consultando los análisis…</p>}
      {queue.error && <p role="alert">{queue.error} <button type="button" className="underline" onClick={queue.retry}>Reintentar consulta</button></p>}
      {!queue.loading && !queue.error && application.videoPaths.map((path, index) => (
        <Video key={path} index={index} path={path} service={service} canAnalyze={canAnalyze}
          match={queue.rows.find((item) => item.videoPath === path)} />
      ))}
      {application.videoLinks.length > 0 && (
        <div className="mt-3">
          <button type="button" className="players-button-secondary" disabled>Analizar enlaces</button>
          <p className="text-sm text-muted">La importación por enlace aún no está habilitada para postulaciones.</p>
        </div>
      )}
    </section>
  )
}
