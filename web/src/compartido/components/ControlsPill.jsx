import { useContext } from 'react'
import LinkDeslizante from './LinkDeslizante.jsx'
import MenuCuenta from './MenuCuenta.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { AuthContext } from '../../panel/context/AuthContext.js'
import { useIdioma } from '../lib/idioma.jsx'

const textos = {
  es: {
    idioma: 'Cambiar idioma a inglés',
    tituloIdioma: 'Idioma',
    ingresar: 'Ingresar',
  },
  en: {
    idioma: 'Cambiar idioma a español',
    tituloIdioma: 'Language',
    ingresar: 'Log in',
  },
}

export default function ControlsPill({ ocultarIngreso = false, cuenta = false, className = '' }) {
  const sesion = useContext(AuthContext)
  const usuario = cuenta ? sesion?.user : null
  const { idioma, cambiarIdioma } = useIdioma()
  const t = textos[idioma]

  const control =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:bg-accent/10 hover:text-accent-ink'

  return (
    <div
      className={`fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-50 flex items-center gap-0.5 rounded-full border border-line2 bg-surface2/80 p-1 shadow-tile backdrop-blur-lg transition-opacity duration-300 sm:right-6 ${className}`}
    >
      <ThemeToggle className={control} />
      <button
        type="button"
        onClick={cambiarIdioma}
        aria-label={t.idioma}
        title={t.tituloIdioma}
        className={control}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>
      {usuario ? (
        <MenuCuenta
          idioma={idioma}
          nombre={sesion.profile?.displayName ?? usuario.email}
          correo={usuario.email}
          onSalir={sesion.logout}
        />
      ) : (
        <LinkDeslizante
          to="/login"
          aria-hidden={ocultarIngreso}
          tabIndex={ocultarIngreso ? -1 : undefined}
          className={`inline-flex h-9 items-center overflow-hidden rounded-full text-sm font-semibold whitespace-nowrap text-text2 transition-all duration-500 hover:bg-accent/10 hover:text-accent-ink ${
            ocultarIngreso
              ? 'pointer-events-none max-w-0 px-0 opacity-0'
              : 'max-w-28 px-3.5 opacity-100'
          }`}
        >
          {t.ingresar}
        </LinkDeslizante>
      )}
    </div>
  )
}
