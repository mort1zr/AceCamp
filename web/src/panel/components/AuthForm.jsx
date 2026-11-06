// Marco y campos compartidos por Login y Registro (PCIT-21).
import { useState } from 'react'
import { useTextos } from '../../compartido/lib/idioma.jsx'

const textosClave = {
  es: { mostrar: 'Mostrar contraseña', ocultar: 'Ocultar contraseña' },
  en: { mostrar: 'Show password', ocultar: 'Hide password' },
}

// Ojo abierto (mostrar) o tachado (ocultar).
function IconoOjo({ tachado }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {tachado ? <path d="M4 4l16 16" /> : null}
    </svg>
  )
}

export function AuthHeader({ title, subtitle, compacto = false }) {
  return (
    <div className={compacto ? 'mb-4' : 'mb-6'}>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-text2">{subtitle}</p> : null}
    </div>
  )
}

export function Field({ id, label, error, compacto = false, type = 'text', ...inputProps }) {
  const errorId = `${id}-error`
  const t = useTextos(textosClave)
  // En las contraseñas, el ojo alterna entre ver y ocultar lo que se escribió.
  const esClave = type === 'password'
  const [visible, setVisible] = useState(false)
  const input = (
    <input
      id={id}
      name={id}
      type={esClave && visible ? 'text' : type}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? errorId : undefined}
      className={`w-full rounded-lg border bg-bg px-3 text-sm ${compacto ? 'py-2' : 'py-2.5'} ${esClave ? 'pr-11' : ''} text-text placeholder:text-placeholder focus:border-accent focus:outline-none ${
        error ? 'border-bad' : 'border-line2'
      }`}
      {...inputProps}
    />
  )
  return (
    <div className={`grid ${compacto ? 'gap-1' : 'gap-1.5'}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {esClave ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setVisible((actual) => !actual)}
            aria-label={visible ? t.ocultar : t.mostrar}
            aria-pressed={visible}
            aria-controls={id}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-text2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <IconoOjo tachado={visible} />
          </button>
        </div>
      ) : (
        input
      )}
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
