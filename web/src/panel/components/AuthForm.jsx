// Marco y campos compartidos por Login y Registro (PCIT-21).
import { useState } from 'react'
import BotonVerContrasena from './BotonVerContrasena.jsx'

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
      className={`w-full rounded-lg border bg-bg px-3 text-sm ${compacto ? 'py-2' : 'py-2.5'} ${esClave ? 'pr-11' : ''} text-text placeholder:text-placeholder focus:border-accent-ink focus:ring-1 focus:ring-accent-ink focus:outline-none ${
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
          <BotonVerContrasena visible={visible} onCambiar={() => setVisible((actual) => !actual)} controla={id} />
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
