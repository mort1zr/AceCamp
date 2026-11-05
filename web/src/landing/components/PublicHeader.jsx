import { Link } from 'react-router'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import Logo from '../../compartido/components/Logo.jsx'
import ThemeToggle from '../../compartido/components/ThemeToggle.jsx'
import { useAterrizaje } from '../../compartido/hooks/useAterrizaje.js'
import LinkDeslizante from '../../compartido/components/LinkDeslizante.jsx'

const textos = {
  es: {
    navegacion: 'Navegación principal',
    inicio: 'AceCam, ir al inicio',
    precios: 'Precios',
    sesion: 'Iniciar sesión',
  },
  en: {
    navegacion: 'Main navigation',
    inicio: 'AceCam, go to home',
    precios: 'Pricing',
    sesion: 'Log in',
  },
}

export default function PublicHeader() {
  const t = useTextos(textos)
  const aterrizaje = useAterrizaje()
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <nav
        aria-label={t.navegacion}
        className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3"
      >
        <Link to="/" {...aterrizaje} className="rounded-md" aria-label={t.inicio}>
          <Logo rebota />
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/precios"
            className="hidden text-sm font-medium text-text2 hover:text-text sm:block"
          >
            {t.precios}
          </Link>
          <LinkDeslizante to="/login" className="text-sm font-medium text-text2 hover:text-text">
            {t.sesion}
          </LinkDeslizante>
          <ThemeToggle className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-surface text-text2 transition-colors hover:border-line2 hover:text-text" />
        </div>
      </nav>
    </header>
  )
}
