import './ui.css'

const statuses = {
  'en cola': { label: 'En cola', tone: 'neutral' },
  procesando: { label: 'Procesando', tone: 'accent' },
  listo: { label: 'Listo', tone: 'positive' },
  error: { label: 'Error', tone: 'negative' },
  nueva: { label: 'Nueva', tone: 'accent' },
  'en revisión': { label: 'En revisión', tone: 'neutral' },
  analizada: { label: 'Analizada', tone: 'positive' },
  contactada: { label: 'Contactada', tone: 'positive' },
  descartada: { label: 'Descartada', tone: 'neutral' },
}

export function StatusBadge({ status, label }) {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : ''
  const known = statuses[normalized]
  const text = label ?? known?.label ?? (normalized ? status : 'Sin estado')

  return (
    <span className={`ac-ui ac-badge ac-tone-${known?.tone ?? 'neutral'}`}>
      <span className="ac-badge__dot" aria-hidden="true" />
      {text}
    </span>
  )
}
