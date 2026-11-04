import { Link } from 'react-router'
import Logo from './Logo.jsx'

const year = new Date().getFullYear()

const columns = [
  {
    title: 'Producto',
    links: [
      { to: '/precios', label: 'Precios' },
      { to: '/registro', label: 'Crear cuenta' },
      { to: '/login', label: 'Iniciar sesión' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/terminos', label: 'Términos del servicio' },
      { to: '/privacidad', label: 'Política de privacidad' },
    ],
  },
]

export default function PublicFooter() {
  return (
    <footer className="border-t border-line px-6 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Análisis de partidos de tenis con IA para entrenadores, academias y reclutadores.
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="font-display text-sm tracking-[0.18em] text-muted uppercase">
              {column.title}
            </h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-text2 hover:text-text">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div>
          <h2 className="font-display text-sm tracking-[0.18em] text-muted uppercase">Contacto</h2>
          <ul className="mt-3 space-y-2 text-sm text-text2">
            <li>
              <a href="mailto:hola@acecam.pe" className="hover:text-text">
                hola@acecam.pe
              </a>
            </li>
            <li>
              <a
                href="https://instagram.com/acecam"
                className="hover:text-text"
                rel="noreferrer noopener"
                target="_blank"
              >
                Instagram
              </a>
            </li>
            <li>
              <a
                href="https://tiktok.com/@acecam"
                className="hover:text-text"
                rel="noreferrer noopener"
                target="_blank"
              >
                TikTok
              </a>
            </li>
          </ul>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-6xl border-t border-line pt-6 text-xs text-muted">
        © {year} AceCam · Lima, Perú
      </p>
    </footer>
  )
}
