import './ui.css'

export function LoadingState({ title = 'Cargando…', description }) {
  return (
    <div className="ac-ui ac-feedback" role="status" aria-live="polite">
      <span className="ac-spinner" aria-hidden="true" />
      <p className="ac-feedback__title">{title}</p>
      {description && <p className="ac-feedback__description">{description}</p>}
    </div>
  )
}

export function EmptyState({ title = 'Todavía no hay datos', description, actionLabel, onAction }) {
  return (
    <div className="ac-ui ac-feedback" role="status">
      <span className="ac-feedback__symbol" aria-hidden="true">—</span>
      <p className="ac-feedback__title">{title}</p>
      {description && <p className="ac-feedback__description">{description}</p>}
      {actionLabel && onAction && <button className="ac-button" type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  )
}

export function ErrorState({ title = 'No pudimos cargar los datos', description, onRetry, retryLabel = 'Reintentar' }) {
  return (
    <div className="ac-ui ac-feedback">
      <div role="alert">
        <span className="ac-feedback__symbol ac-tone-negative" aria-hidden="true">!</span>
        <p className="ac-feedback__title">{title}</p>
        {description && <p className="ac-feedback__description">{description}</p>}
      </div>
      {onRetry && <button className="ac-button" type="button" onClick={onRetry}>{retryLabel}</button>}
    </div>
  )
}
