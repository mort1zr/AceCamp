import { EmptyState } from '../ui'

/** The real Recharts visualization is delivered by PCIT-140 through this slot. */
export default function EvolutionPanel({ playerId, renderEvolution }) {
  return (
    <section className="dashboard-panel dashboard-evolution" aria-labelledby="dashboard-evolution-title">
      <div className="dashboard-panel-heading"><div><p className="players-eyebrow">El rendimiento, en perspectiva</p><h2 id="dashboard-evolution-title">Evolución del jugador</h2></div><span className="dashboard-unit">Partidos analizados</span></div>
      {renderEvolution ? renderEvolution({ playerId }) : <EmptyState title="La evolución aún no está disponible" description="Aquí podrás consultar cómo cambia el rendimiento del jugador a lo largo de sus partidos." />}
    </section>
  )
}
