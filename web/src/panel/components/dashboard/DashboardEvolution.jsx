import { useId } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, ErrorState, LoadingState } from '../ui'
import { formatMatchDate, selectEvolutionPoints } from '../../lib/dashboardEvolution.js'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import './evolution.css'

const speedFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const speedText = (value, unidades = 'kmh') => value == null ? 'Sin datos' : `${speedFormat.format(convertirVelocidad(value, unidades))} ${etiquetaVelocidad(unidades)}`

function EvolutionTooltip({ active, payload, unidades }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="evolution-tooltip"><strong>{formatMatchDate(point.date)}</strong><p>{point.opponent ? `vs. ${point.opponent}` : 'Rival sin registrar'}</p><p>{speedText(point.averageShotSpeed, unidades)}</p></div>
}

export default function DashboardEvolution({ playerId, evolution, loading = false, error, onRetry, sample = false }) {
  const id = useId()
  const unidades = useUnidades()
  if (loading) return <div aria-busy="true"><LoadingState title="Cargando evolución…" /></div>
  if (error) return <ErrorState title="No pudimos cargar la evolución" description={typeof error === 'string' ? error : undefined} onRetry={onRetry} />
  if (!evolution || evolution.playerId !== playerId) return <EmptyState title="La evolución aún no está disponible" description="Aquí podrás consultar cómo cambia el rendimiento del jugador a lo largo de sus partidos." />
  const points = selectEvolutionPoints(evolution, playerId)
  const chartPoints = points.map(point => ({ ...point, speed: convertirVelocidad(point.averageShotSpeed, unidades) }))
  if (points.length === 0) return <EmptyState title="Aún no hay partidos con fecha válida" description="La evolución aparecerá cuando haya análisis con la fecha del partido registrada." />
  const measured = points.filter(point => point.averageShotSpeed != null)
  const byId = new Map(points.map(point => [point.matchId, point]))

  return (
    <div className="evolution-content">
      {sample && <p className="evolution-sample">Gráfico de demostración · valores ficticios</p>}
      {measured.length === 0 ? <EmptyState title="Todavía no hay velocidades de golpe disponibles" description="Los partidos están registrados, pero no tienen mediciones de golpe utilizables." /> : <figure className="evolution-figure" aria-labelledby={`${id}-caption`}>
        <figcaption id={`${id}-caption`}>Velocidad media de golpe <span>{etiquetaVelocidad(unidades)}</span></figcaption>
        <ResponsiveContainer width="100%" height={280} minWidth={0} initialDimension={{ width: 600, height: 280 }}>
          <LineChart data={chartPoints} accessibilityLayer title="Evolución de velocidad media de golpe" margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--players-line)" strokeDasharray="3 3" />
            <XAxis dataKey="matchId" tickFormatter={key => formatMatchDate(byId.get(key)?.date, true)} tick={{ fill: 'var(--players-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--players-line)' }} tickLine={false} minTickGap={24} />
            <YAxis width={48} domain={[0, 'auto']} tick={{ fill: 'var(--players-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<EvolutionTooltip unidades={unidades} />} filterNull={false} cursor={{ stroke: 'var(--players-line)' }} />
            <Line dataKey="speed" name="Velocidad media de golpe" unit={` ${etiquetaVelocidad(unidades)}`} type="linear" stroke="var(--electric, #4FE3FF)" strokeWidth={2.5} connectNulls={false} isAnimationActive={false} dot={{ r: 4, fill: 'var(--electric, #4FE3FF)', strokeWidth: 0 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </figure>}
      <p className="evolution-note">{measured.length === 1 ? 'Solo hay una medición disponible; todavía no permite inferir una tendencia. ' : ''}Cada posición representa un partido, ordenado por fecha. Los valores ausentes no se sustituyen por cero ni se unen con una línea.</p>
      <details className="evolution-details"><summary>Ver datos del gráfico</summary><div className="evolution-table-scroll" tabIndex={0} role="region" aria-label="Datos de evolución"><table><caption>Velocidades de golpe por partido{sample ? ' · ejemplos' : ''}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Rival</th><th scope="col">Velocidad media</th></tr></thead><tbody>{points.map(point => <tr key={point.matchId}><td>{formatMatchDate(point.date)}</td><td>{point.opponent || 'Sin registrar'}</td><td>{speedText(point.averageShotSpeed, unidades)}</td></tr>)}</tbody></table></div></details>
    </div>
  )
}
