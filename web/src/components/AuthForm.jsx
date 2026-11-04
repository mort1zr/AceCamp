import { Link } from 'react-router'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'

// Marco y campos compartidos por Login y Registro (PCIT-21).

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-bg px-4 py-10 text-text">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 flex w-fit" aria-label="AceCam, ir al inicio">
          <Logo />
        </Link>
        <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-text2">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <p className="mt-6 text-center text-sm text-text2">{footer}</p> : null}
      </div>
    </div>
  )
}

export function Field({ id, label, error, ...inputProps }) {
  const errorId = `${id}-error`
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border bg-bg px-3 py-2.5 text-sm text-text placeholder:text-placeholder focus:border-accent focus:outline-none ${
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
