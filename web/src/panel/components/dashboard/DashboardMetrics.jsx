import { KpiCard } from '../ui'
import { useContador } from '../../hooks/useContador.js'
import { useUnidades } from '../../hooks/useUnidades.js'
import { completeDashboardMetricDefinitions, isDashboardMetricValue } from '../../lib/dashboardOverview.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const changeFormat = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
function Flecha({ sube }) {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mr-1 inline-block align-[-1px]"
    >
      {sube ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </svg>
  )
}

function trendLabel(metric, value, previous, unidades) {
  if (!isDashboardMetricValue(metric, previous)) return 'Sin datos para comparar'
  const difference = value - previous
  const displayed = metric.speed ? convertirVelocidad(difference, unidades) : difference
  const unit = metric.speed ? ` ${etiquetaVelocidad(unidades)}` : metric.unit === '%' ? ' p. p.' : metric.unit ? ` ${metric.unit}` : ''
  const texto = `${changeFormat.format(displayed)}${unit}`
  if (difference === 0) return <><span>{texto}</span> vs. periodo anterior</>
  const mejora = metric.lowerIsBetter ? difference < 0 : difference > 0
  return (
    <>
      <span className={`font-semibold ${mejora ? 'ac-tone-positive' : 'ac-tone-negative'}`}>
        <Flecha sube={difference > 0} />
        {texto}
      </span>{' '}
      vs. periodo anterior
    </>
  )
}

function Animado({ valor }) {
  const decimales = Number.isInteger(Math.round(valor * 10) / 10) ? 0 : 1
  const actual = useContador(valor, { duracion: 700 })
  const formato = new Intl.NumberFormat('es-PE', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
  return (
    <span className="inline-block text-right tabular-nums" style={{ minWidth: `${formato.format(valor).length}ch` }}>
      {formato.format(actual)}
    </span>
  )
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
            value={valid ? <Animado valor={metric.speed ? convertirVelocidad(raw, unidades) : raw} /> : null}
            unit={metric.speed ? etiquetaVelocidad(unidades) : metric.unit}
            description={valid ? (sample ? 'Valor de ejemplo' : undefined) : 'Sin datos'}
            trend={compare && valid ? trendLabel(metric, raw, previousMetrics?.[metric.key], unidades) : undefined}
          />
        )
      })}
    </div>
  )
}
