import { useTheme } from '../hooks/useTheme.js'
import { useTextos } from '../lib/idioma.jsx'

const textos = {
  es: {
    temaOscuro: 'Activar tema oscuro',
    temaClaro: 'Activar tema claro',
    tituloOscuro: 'Tema oscuro',
    tituloClaro: 'Tema claro',
  },
  en: {
    temaOscuro: 'Switch to dark theme',
    temaClaro: 'Switch to light theme',
    tituloOscuro: 'Dark theme',
    tituloClaro: 'Light theme',
  },
}

export default function ThemeToggle({ className }) {
  const { toggleTheme, isLight } = useTheme()
  const t = useTextos(textos)

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? t.temaOscuro : t.temaClaro}
      title={isLight ? t.tituloOscuro : t.tituloClaro}
      className={className}
    >
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
        {isLight ? (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        )}
      </svg>
    </button>
  )
}
