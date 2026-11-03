import { Link } from 'react-router'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const anchors = [
  { href: '#el-problema', label: 'El problema' },
  { href: '#la-solucion', label: 'La solución' },
  { href: '#que-mide', label: 'Qué mide' },
  { href: '#como-funciona', label: 'Cómo funciona' },
]

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur">
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3"
      >
        <Link to="/" className="rounded-md" aria-label="AceCam, ir al inicio">
          <Logo />
        </Link>

        <ul className="ml-4 hidden items-center gap-6 lg:flex">
          {anchors.map((anchor) => (
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
            Precios
          </Link>
          <Link to="/login" className="text-sm font-medium text-text2 hover:text-text">
            Iniciar sesión
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
