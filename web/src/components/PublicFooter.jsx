import { Link } from 'react-router'
import LinkDeslizante from './LinkDeslizante.jsx'
import Logo from './Logo.jsx'

const year = new Date().getFullYear()

const links = [
  { to: '/precios', label: 'Precios', desliza: true },
  { to: '/registro', label: 'Crear cuenta' },
  { to: '/terminos', label: 'Términos' },
  { to: '/privacidad', label: 'Privacidad' },
]

const redes = [
  { href: 'https://instagram.com/acecam', label: 'Instagram' },
  { href: 'https://tiktok.com/@acecam', label: 'TikTok' },
]

export default function PublicFooter() {
  return (
    <footer className="border-t border-line px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <Logo />

        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text2">
            {links.map(({ desliza, ...link }) => {
              const Enlace = desliza ? LinkDeslizante : Link
              return (
                <li key={link.to}>
                  <Enlace to={link.to} className="hover:text-text">
                    {link.label}
                  </Enlace>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-6 flex max-w-6xl flex-col gap-3 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} AceCam · Lima, Perú</p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li>
            <a href="mailto:consultas@acecam.com" className="hover:text-text">
              consultas@acecam.com
            </a>
          </li>
          {redes.map((red) => (
            <li key={red.label}>
              <a
                href={red.href}
                className="hover:text-text"
                rel="noreferrer noopener"
                target="_blank"
              >
                {red.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
