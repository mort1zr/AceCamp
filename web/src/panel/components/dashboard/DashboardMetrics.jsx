import { KpiCard } from '../ui'
import { useUnidades } from '../../hooks/useUnidades.js'
import { completeDashboardMetricDefinitions, isDashboardMetricValue } from '../../lib/dashboardOverview.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const changeFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
function trendLabel(metric, value, previous, unidades) {
  if (!isDashboardMetricValue(metric, previous)) return 'Sin datos para comparar'
  const difference = value - previous
  const displayed = metric.speed ? convertirVelocidad(difference, unidades) : difference
  const unit = metric.speed ? ` ${etiquetaVelocidad(unidades)}` : metric.unit === '%' ? ' p. p.' : metric.unit ? ` ${metric.unit}` : ''
  return `${changeFormat.format(displayed)}${unit} vs. periodo anterior`
}

export default function DashboardMetrics({ metrics, previousMetrics, compare = false, sample = false }) {
  const unidades = useUnidades()
  return (
    <div className="dashboard-metrics">
      {completeDashboardMetricDefinitions.map(metric => {
        const raw = metrics?.[metric.key]
        const valid = isDashboardMetricValue(metric, raw)
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
