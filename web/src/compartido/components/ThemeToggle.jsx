import { useTheme } from '../hooks/useTheme.js'

export default function ThemeToggle({ className = '' }) {
  const { toggleTheme, isLight } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Activar tema oscuro' : 'Activar tema claro'}
      title={isLight ? 'Tema oscuro' : 'Tema claro'}
      className={`inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-text2 transition-colors hover:border-line2 hover:text-text ${className}`}
    >
      {isLight ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
