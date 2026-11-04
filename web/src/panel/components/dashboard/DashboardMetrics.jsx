import { KpiCard } from '../ui'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const definitions = [
  { key: 'analyzedMatches', label: 'Partidos analizados', integer: true },
  { key: 'measuredShots', label: 'Golpes medidos', integer: true, optional: true },
  { key: 'averageShotSpeed', label: 'Velocidad media de golpe', speed: true, optional: true },
  { key: 'averageServeSpeed', label: 'Velocidad media de saque', speed: true },
  { key: 'firstServeInRate', label: 'Primer saque dentro', unit: '%', max: 100 },
  { key: 'doubleFaults', label: 'Dobles faltas', integer: true },
]

export default function DashboardMetrics({ metrics, sample = false }) {
  const unidades = useUnidades()
  return (
    <div className="dashboard-metrics">
      {definitions.filter(metric => !metric.optional || Object.hasOwn(metrics ?? {}, metric.key)).map(metric => {
        const raw = metrics?.[metric.key]
        const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && (!metric.integer || Number.isSafeInteger(raw)) && (metric.max == null || raw <= metric.max)
        return <KpiCard key={metric.key} label={metric.label} value={valid ? numberFormat.format(metric.speed ? convertirVelocidad(raw, unidades) : raw) : null} unit={metric.speed ? etiquetaVelocidad(unidades) : metric.unit} description={valid ? (sample ? 'Valor de ejemplo' : 'Según los análisis disponibles') : 'Sin datos'} />
      })}
    </div>
  )
}
