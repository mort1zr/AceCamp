import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DashboardEvolution from './DashboardEvolution.jsx'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const number = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const text = value => value == null ? 'Sin datos' : number.format(value)
const card = 'rounded-card border border-line bg-surface p-5 min-w-0'

function BarTooltip({ active, payload }) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return <div className="evolution-tooltip"><strong>{row.label}</strong><p>{text(row.value)}</p></div>
}

function Bars({ title, rows, note, playerId }) {
  const id = useId()
  return <section className={card} aria-labelledby={id}>
    <h2 id={id} className="font-display text-[22px] font-bold">{title}</h2>
    <p className="mt-2 text-sm text-muted">{note}</p>
    {rows.some(row => row.value != null) ? <figure className="mt-4" aria-label={`Gráfico de ${title.toLowerCase()}`}>
      <ResponsiveContainer width="100%" height={220} minWidth={0} initialDimension={{ width: 600, height: 220 }}>
        <BarChart data={rows} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--players-line)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--players-muted)', fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fill: 'var(--players-muted)', fontSize: 11 }} />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--players-line)', fillOpacity: 0.35 }} />
          <Bar key={playerId} dataKey="value" name="Cantidad" fill="var(--electric, #4FE3FF)" isAnimationActive animationDuration={700} animationEasing="ease-out" />
        </BarChart>
      </ResponsiveContainer>
    </figure> : <p className="py-8 text-muted">Sin datos para este periodo.</p>}
    <div className="evolution-table-scroll mt-3" tabIndex={0} role="region" aria-label={`Datos de ${title.toLowerCase()}`}>
      <table><caption>{title}: datos del periodo</caption><thead><tr><th scope="col">Categoría</th><th scope="col">Cantidad</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{text(row.value)}</td></tr>)}</tbody>
      </table>
    </div>
  </section>
}

export default function DashboardDetails({ details, serveEvolution, playerId, sample = false }) {
  const units = useUnidades()
  const { serve, rallies, movement } = details ?? {}
  return <>
    <p className="text-sm text-muted">Los indicadores totales requieren los contadores de todos los análisis del periodo. Los peloteos muestran los análisis con distribución disponible e indican su cobertura.</p>
    <section className={card} aria-labelledby="serve-evolution-title">
      <h2 id="serve-evolution-title" className="font-display text-[22px] font-bold">Evolución del saque</h2>
      <p className="mt-2 text-sm text-muted">Velocidad media hasta el bote, por partido. No equivale a la velocidad de salida medida por un radar.</p>
      <DashboardEvolution playerId={playerId} evolution={serveEvolution} metric="averageServeSpeed" sample={sample} />
    </section>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-4">
      <Bars playerId={playerId} title="Saque" note="Resultados medidos. Los segundos saques dentro aún no están disponibles; no se deducen del total de intentos. Si un análisis carece de un contador, el total queda Sin datos."
        rows={[{ label: 'Primeros dentro', value: serve?.firstIn }, { label: 'Segundos dentro', value: serve?.secondIn }, { label: 'Dobles faltas', value: serve?.doubleFaults }]} />
      <Bars playerId={playerId} title="Peloteos" note={`${rallies?.coveredMatches ?? 0} de ${rallies?.totalMatches ?? 0} análisis con distribución disponible. Tramos: 0–4, 5–8 y 9 o más golpes. Media: ${text(rallies?.averageShots)}; más largo: ${text(rallies?.longestShots)}. Los golpes de un peloteo pueden incluir golpes sin velocidad medible.`}
        rows={[{ label: '0–4 golpes', value: rallies?.short }, { label: '5–8 golpes', value: rallies?.medium }, { label: '9+ golpes', value: rallies?.long }]} />
    </div>
    <section className={card} aria-labelledby="movement-title">
      <h2 id="movement-title" className="font-display text-[22px] font-bold">Físico y movimiento</h2>
      <dl className="mt-3 flex flex-wrap gap-8"><div><dt>Distancia acumulada</dt><dd>{text(movement?.distanceMeters)}{movement?.distanceMeters != null && ' m'}</dd></div>
        <div><dt>Velocidad máxima</dt><dd>{text(movement?.maxSpeedKmh == null ? null : convertirVelocidad(movement.maxSpeedKmh, units))}{movement?.maxSpeedKmh != null && ` ${etiquetaVelocidad(units)}`}</dd></div></dl>
      <h3 className="mt-5 font-semibold">Mapa de calor</h3><p className="mt-2 text-sm text-muted">Sin datos: el worker guarda distancias y velocidades, pero aún no publica posiciones por zona para construir un mapa de calor.</p>
    </section>
  </>
}
