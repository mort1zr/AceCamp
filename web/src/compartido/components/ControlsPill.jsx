import LinkDeslizante from './LinkDeslizante.jsx'
import { useTheme } from '../hooks/useTheme.js'
import { useIdioma } from '../lib/idioma.jsx'

const textos = {
  es: {
    temaOscuro: 'Activar tema oscuro',
    temaClaro: 'Activar tema claro',
    tituloOscuro: 'Tema oscuro',
    tituloClaro: 'Tema claro',
    idioma: 'Cambiar idioma a inglés',
    tituloIdioma: 'Idioma',
    ingresar: 'Ingresar',
  },
  en: {
    temaOscuro: 'Switch to dark theme',
    temaClaro: 'Switch to light theme',
    tituloOscuro: 'Dark theme',
    tituloClaro: 'Light theme',
    idioma: 'Cambiar idioma a español',
    tituloIdioma: 'Language',
    ingresar: 'Log in',
  },
}

export default function ControlsPill({ ocultarIngreso = false, className = '' }) {
  const { toggleTheme, isLight } = useTheme()
  const { idioma, cambiarIdioma } = useIdioma()
  const t = textos[idioma]

  const control =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:bg-accent/10 hover:text-accent-ink'

  return (
    <div
      className={`fixed top-[max(1rem,env(safe-area-inset-top))] right-4 z-50 flex items-center gap-0.5 rounded-full border border-line2 bg-surface2/80 p-1 shadow-tile backdrop-blur-lg transition-opacity duration-300 sm:right-6 ${className}`}
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isLight ? t.temaOscuro : t.temaClaro}
        title={isLight ? t.tituloOscuro : t.tituloClaro}
        className={control}
      >
        {isLight ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        )}
      </button>
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
    </div>
  )
}
