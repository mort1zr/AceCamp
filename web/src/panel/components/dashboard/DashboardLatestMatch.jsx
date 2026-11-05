import { useUnidades } from '../../hooks/useUnidades.js'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function textValue(value) {
  return typeof value === 'string' && value.trim() ? value : 'Sin datos'
}

export default function DashboardLatestMatch({ match }) {
  const unidades = useUnidades()
  const speed = match.averageShotSpeed
  const speedLabel = Number.isFinite(speed) && speed >= 0
    ? `${numberFormat.format(convertirVelocidad(speed, unidades))} ${etiquetaVelocidad(unidades)}`
    : 'Sin datos'
  const fields = [
    ['Torneo', textValue(match.tournament)],
    ['Marcador', textValue(match.result)],
    ['Golpes medidos', Number.isSafeInteger(match.measuredShots) && match.measuredShots >= 0
      ? numberFormat.format(match.measuredShots) : 'Sin datos'],
    ['Velocidad media de golpe', speedLabel],
  ]

  return (
    <section className="rounded-card border border-line bg-surface p-5 flex flex-col gap-4" aria-labelledby="dashboard-last-match-title">
      <div>
        <h2 id="dashboard-last-match-title" className="font-display text-[22px] leading-tight font-bold tracking-[0.01em]">Último partido</h2>
        <p className="mt-1 text-[13px] text-muted"><time dateTime={match.date}>{formatMatchDate(match.date)}</time></p>
      </div>
      <p className="font-semibold break-words">Rival · {textValue(match.opponent)}</p>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-3">
        {fields.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line p-3">
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="mt-1 font-semibold break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
