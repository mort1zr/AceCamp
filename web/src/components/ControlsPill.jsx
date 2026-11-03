import { useState } from 'react'
import { useTheme } from '../hooks/useTheme.js'

const LANG_KEY = 'acecam-lang'

function readLang() {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

export default function ControlsPill({ className = '' }) {
  const { toggleTheme, isLight } = useTheme()
  const [lang, setLang] = useState(readLang)

  const toggleLang = () => {
    const next = lang === 'es' ? 'en' : 'es'
    setLang(next)
    document.documentElement.lang = next
    try {
      localStorage.setItem(LANG_KEY, next)
    } catch {
      return
    }
  }

  const control =
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:bg-accent/10 hover:text-accent-ink'

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-0.5 rounded-full border border-line2 bg-surface2/80 p-1 shadow-tile backdrop-blur-lg sm:right-6 ${className}`}
    >
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isLight ? 'Activar tema oscuro' : 'Activar tema claro'}
        title={isLight ? 'Tema oscuro' : 'Tema claro'}
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
        onClick={toggleLang}
        aria-label={lang === 'es' ? 'Cambiar idioma a inglés' : 'Switch language to Spanish'}
        title={lang === 'es' ? 'Idioma' : 'Language'}
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
        <span className="text-xs font-bold tracking-wide">{lang.toUpperCase()}</span>
      </button>
    </div>
  )
}
