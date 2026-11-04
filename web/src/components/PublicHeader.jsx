import { Link } from 'react-router'
import { useTextos } from '../lib/idioma.jsx'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const textos = {
  es: {
    anclas: [
      { href: '#el-problema', label: 'El problema' },
      { href: '#la-solucion', label: 'La solución' },
      { href: '#que-mide', label: 'Qué mide' },
      { href: '#como-funciona', label: 'Cómo funciona' },
    ],
    navegacion: 'Navegación principal',
    inicio: 'AceCam, ir al inicio',
    precios: 'Precios',
    sesion: 'Iniciar sesión',
  },
  en: {
    anclas: [
      { href: '#el-problema', label: 'The problem' },
      { href: '#la-solucion', label: 'The solution' },
      { href: '#que-mide', label: 'What it measures' },
      { href: '#como-funciona', label: 'How it works' },
    ],
    navegacion: 'Main navigation',
    inicio: 'AceCam, go to home',
    precios: 'Pricing',
    sesion: 'Log in',
  },
}

export default function PublicHeader() {
  const t = useTextos(textos)
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <nav
        aria-label={t.navegacion}
        className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3"
      >
        <Link to="/" className="rounded-md" aria-label={t.inicio}>
          <Logo />
        </Link>

        <ul className="ml-4 hidden items-center gap-6 lg:flex">
          {t.anclas.map((anchor) => (
            <li key={anchor.href}>
              <a href={anchor.href} className="text-sm text-text2 hover:text-text">
                {anchor.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            to="/precios"
            className="hidden text-sm font-medium text-text2 hover:text-text sm:block"
          >
            {t.precios}
          </Link>
          <Link to="/login" className="text-sm font-medium text-text2 hover:text-text">
            {t.sesion}
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
