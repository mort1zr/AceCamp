import './ui.css'

/** Presentational only: the caller calculates the metric and its trend. */
export function KpiCard({ label, value, unit, description, trend, trendTone = 'neutral' }) {
  const tone = ['positive', 'negative'].includes(trendTone) ? trendTone : 'neutral'

  return (
    <article className="ac-ui ac-kpi">
      <h3 className="ac-kpi__label">{label}</h3>
      <p className="ac-kpi__value">
        {value ?? '—'}{value != null && unit && <span className="ac-kpi__unit"> {unit}</span>}
      </p>
      {trend != null && <p className={`ac-kpi__trend ac-tone-${tone}`}>{trend}</p>}
      {description && <p className="ac-kpi__description">{description}</p>}
    </article>
  )
}
