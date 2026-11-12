import { useId } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../ui'
import { formatMatchDate, selectEvolutionPoints } from '../../lib/dashboardEvolution.js'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import './evolution.css'

const speedFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const speedText = (value, unidades = 'kmh') => value == null ? 'Sin datos' : `${speedFormat.format(convertirVelocidad(value, unidades))} ${etiquetaVelocidad(unidades)}`

function speedDomain(values) {
  if (values.length === 0) return [0, 'auto']
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(2, (max - min) * 0.25)
  return [Math.max(0, Math.floor((min - pad) / 5) * 5), Math.ceil((max + pad) / 5) * 5]
}

function EvolutionTooltip({ active, payload, unidades, metric }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="evolution-tooltip"><strong>{formatMatchDate(point.date)}</strong><p>{point.opponent ? `vs. ${point.opponent}` : 'Rival sin registrar'}</p><p>{speedText(point[metric], unidades)}</p></div>
}

export default function DashboardEvolution({ playerId, evolution, loading = false, error, onRetry, sample = false, metric = 'averageShotSpeed' }) {
  const id = useId()
  const unidades = useUnidades()
  const kind = metric === 'averageServeSpeed' ? 'saque' : 'golpe'
  const label = `Velocidad media de ${kind}`
  if (loading) return <div aria-busy="true"><LoadingState title="Cargando evolución…" /></div>
  if (error) return <ErrorState title="No pudimos cargar la evolución" description={typeof error === 'string' ? error : undefined} onRetry={onRetry} />
  if (!evolution || evolution.playerId !== playerId) return <EmptyState title="La evolución aún no está disponible" description="Aquí podrás consultar cómo cambia el rendimiento del jugador a lo largo de sus partidos." />
  const points = selectEvolutionPoints(evolution, playerId, metric)
  const chartPoints = points.map(point => ({ ...point, speed: convertirVelocidad(point[metric], unidades) }))
  if (points.length === 0) return <EmptyState title="Aún no hay partidos con fecha válida" description="La evolución aparecerá cuando haya análisis con la fecha del partido registrada." />
  const measured = points.filter(point => point[metric] != null)
  const byId = new Map(points.map(point => [point.matchId, point]))
  const domain = speedDomain(chartPoints.map(point => point.speed).filter(value => value != null))

  return (
    <div className="evolution-content">
      {sample && <p className="evolution-sample">Gráfico de demostración · valores ficticios</p>}
      {measured.length === 0 ? <EmptyState title={`Todavía no hay velocidades de ${kind} disponibles`} description={`Sin datos: los partidos registrados no tienen mediciones de ${kind} utilizables.`} /> : <figure className="evolution-figure" aria-labelledby={`${id}-caption`}>
        <figcaption id={`${id}-caption`}>{label} <span>{etiquetaVelocidad(unidades)}</span></figcaption>
        <ResponsiveContainer width="100%" height={280} minWidth={0} initialDimension={{ width: 600, height: 280 }}>
          <LineChart data={chartPoints} accessibilityLayer title={`Evolución de velocidad media de ${kind}`} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--players-line)" strokeDasharray="3 3" />
            <XAxis dataKey="matchId" tickFormatter={key => formatMatchDate(byId.get(key)?.date, true)} tick={{ fill: 'var(--players-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--players-line)' }} tickLine={false} minTickGap={24} />
            <YAxis width={48} domain={domain} allowDecimals={false} tick={{ fill: 'var(--players-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<EvolutionTooltip unidades={unidades} metric={metric} />} filterNull={false} cursor={{ stroke: 'var(--players-line)' }} />
            <Line dataKey="speed" name={label} unit={` ${etiquetaVelocidad(unidades)}`} type="linear" stroke="var(--electric, #4FE3FF)" strokeWidth={2.5} connectNulls={false} isAnimationActive={false} dot={{ r: 4, fill: 'var(--electric, #4FE3FF)', strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </figure>}
      <p className="evolution-note">{measured.length === 1 ? 'Solo hay una medición disponible; todavía no permite inferir una tendencia. ' : ''}Cada posición representa un partido, ordenado por fecha. Los valores ausentes no se sustituyen por cero ni se unen con una línea.</p>
      <details className="evolution-details"><summary>Ver datos del gráfico</summary><div className="evolution-table-scroll" tabIndex={0} role="region" aria-label={`Datos de evolución de ${kind}`}><table><caption>Velocidades de {kind} por partido{sample ? ' · ejemplos' : ''}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Rival</th><th scope="col">Velocidad media</th></tr></thead><tbody>{points.map(point => <tr key={point.matchId}><td>{formatMatchDate(point.date)}</td><td>{point.opponent || 'Sin registrar'}</td><td>{speedText(point[metric], unidades)}</td></tr>)}</tbody></table></div></details>
    </div>
  )
}
