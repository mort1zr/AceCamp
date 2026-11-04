import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../context/AuthContext.js'
import Button from './Button.jsx'
import Logo from './Logo.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const sections = [
  { to: '/inicio', label: 'Inicio' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/jugadores', label: 'Jugadores' },
  { to: '/analizar', label: 'Analizar video' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/comparador', label: 'Comparador' },
  { to: '/reclutamiento', label: 'Reclutamiento' },
  { to: '/configuracion', label: 'Configuración' },
]

export default function AppLayout() {
  const { user, profile, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-bg text-text lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-side lg:border-r lg:border-b-0">
        <div className="px-5 py-4">
          <Logo />
        </div>
        <nav aria-label="Secciones" className="px-3 pb-4">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {sections.map((section) => (
              <li key={section.to} className="shrink-0 lg:shrink">
                <NavLink
                  to={section.to}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-chip font-medium text-text'
                        : 'text-text2 hover:bg-surface2 hover:text-text'
                    }`
                  }
                >
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-line px-6 py-3">
          <span className="truncate text-sm text-text2">{profile?.displayName ?? user?.email}</span>
          <ThemeToggle />
          <Button variant="secondary" onClick={logout}>
            Cerrar sesión
          </Button>
        </header>
        <main className="min-w-0 flex-1 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
