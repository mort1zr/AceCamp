// Marco y campos compartidos por Login y Registro (PCIT-21).

export function AuthHeader({ title, subtitle, compacto = false }) {
  return (
    <div className={compacto ? 'mb-4' : 'mb-6'}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-text2">{subtitle}</p> : null}
    </div>
  )
}

export function Field({ id, label, error, compacto = false, ...inputProps }) {
  const errorId = `${id}-error`
  return (
    <div className={`grid ${compacto ? 'gap-1' : 'gap-1.5'}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border bg-bg px-3 text-sm ${compacto ? 'py-2' : 'py-2.5'} text-text placeholder:text-placeholder focus:border-accent focus:outline-none ${
          error ? 'border-bad' : 'border-line2'
        }`}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-xs text-bad">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function FormError({ message }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-bad px-3 py-2 text-sm text-bad">
      {message}
    </p>
  )
}
