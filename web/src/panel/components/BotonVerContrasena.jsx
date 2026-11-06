// Botón del ojo para ver u ocultar una contraseña (login, registro y Configuración).
// Va dentro de un contenedor `relative`, a la derecha del campo (que necesita pr-11).
import { useTextos } from '../../compartido/lib/idioma.jsx'

const textos = {
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

export default function BotonVerContrasena({ visible, onCambiar, controla }) {
  const t = useTextos(textos)
  return (
    <button
      type="button"
      onClick={onCambiar}
      aria-label={visible ? t.ocultar : t.mostrar}
      aria-pressed={visible}
      aria-controls={controla}
      className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-text2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
    >
      <IconoOjo tachado={visible} />
    </button>
  )
}
