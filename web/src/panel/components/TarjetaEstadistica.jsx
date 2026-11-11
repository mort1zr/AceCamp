import { KpiCard } from './ui/KpiCard.jsx'

const formatoEstadistica = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

export function TarjetaEstadistica({ label, value, unit, description, comparison, comparisonTone }) {
  const medidaDisponible = Number.isFinite(value)

  return (
    <KpiCard
      label={label}
      value={medidaDisponible ? formatoEstadistica.format(value) : 'Sin datos'}
      unit={medidaDisponible ? unit : undefined}
      description={description}
      trend={medidaDisponible ? comparison : undefined}
      trendTone={comparisonTone}
    />
  )
}

export function TarjetasEstadisticas({ cards }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map(({ id, ...card }) => <TarjetaEstadistica key={id} {...card} />)}
    </div>
  )
}
