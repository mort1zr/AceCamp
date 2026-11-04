import { KpiCard } from '../ui'

const numberFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const definitions = [
  { key: 'analyzedMatches', label: 'Partidos analizados', integer: true },
  { key: 'measuredShots', label: 'Golpes medidos', integer: true, optional: true },
  { key: 'averageShotSpeed', label: 'Velocidad media de golpe', unit: 'km/h', optional: true },
  { key: 'averageServeSpeed', label: 'Velocidad media de saque', unit: 'km/h' },
  { key: 'firstServeInRate', label: 'Primer saque dentro', unit: '%', max: 100 },
  { key: 'doubleFaults', label: 'Dobles faltas', integer: true },
]

export default function DashboardMetrics({ metrics, sample = false }) {
  return (
    <div className="dashboard-metrics">
      {definitions.filter(metric => !metric.optional || Object.hasOwn(metrics ?? {}, metric.key)).map(metric => {
        const raw = metrics?.[metric.key]
        const valid = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && (!metric.integer || Number.isSafeInteger(raw)) && (metric.max == null || raw <= metric.max)
        return <KpiCard key={metric.key} label={metric.label} value={valid ? numberFormat.format(raw) : null} unit={metric.unit} description={valid ? (sample ? 'Valor de ejemplo' : 'Según los análisis disponibles') : 'Sin datos'} />
      })}
    </div>
  )
}
