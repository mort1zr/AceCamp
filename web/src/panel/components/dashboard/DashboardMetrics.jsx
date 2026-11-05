import { KpiCard } from '../ui'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const changeFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const definitions = [
  { key: 'analyzedMatches', label: 'Partidos analizados', integer: true },
  { key: 'measuredShots', label: 'Golpes medidos', integer: true, optional: true },
  { key: 'averageShotSpeed', label: 'Velocidad media de golpe', speed: true, optional: true },
  { key: 'averageServeSpeed', label: 'Velocidad media de saque', speed: true },
  { key: 'firstServeInRate', label: 'Primer saque dentro', unit: '%', max: 100 },
  { key: 'doubleFaults', label: 'Dobles faltas', integer: true },
]

function validValue(metric, value) {
  return Number.isFinite(value) && value >= 0 && (!metric.integer || Number.isSafeInteger(value))
    && (metric.max == null || value <= metric.max)
}

function trendLabel(metric, value, previous, unidades) {
  if (!validValue(metric, previous)) return 'Sin datos para comparar'
  const difference = value - previous
  const displayed = metric.speed ? convertirVelocidad(difference, unidades) : difference
  const unit = metric.speed ? ` ${etiquetaVelocidad(unidades)}` : metric.unit === '%' ? ' p. p.' : ''
  return `${changeFormat.format(displayed)}${unit} vs. periodo anterior`
}

export default function DashboardMetrics({ metrics, previousMetrics, compare = false, sample = false }) {
  const unidades = useUnidades()
  return (
    <div className="dashboard-metrics">
      {definitions.filter(metric => !metric.optional || Object.hasOwn(metrics ?? {}, metric.key)).map(metric => {
        const raw = metrics?.[metric.key]
        const valid = validValue(metric, raw)
        return (
          <KpiCard
            key={metric.key}
            label={metric.label}
            value={valid ? numberFormat.format(metric.speed ? convertirVelocidad(raw, unidades) : raw) : null}
            unit={metric.speed ? etiquetaVelocidad(unidades) : metric.unit}
            description={valid ? (sample ? 'Valor de ejemplo' : 'Según los análisis disponibles') : 'Sin datos'}
            trend={compare && valid ? trendLabel(metric, raw, previousMetrics?.[metric.key], unidades) : undefined}
          />
        )
      })}
    </div>
  )
}
