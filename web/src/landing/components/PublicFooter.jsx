import { Link } from 'react-router'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import LinkDeslizante from '../../compartido/components/LinkDeslizante.jsx'
import Logo from '../../compartido/components/Logo.jsx'

const year = new Date().getFullYear()

const links = [
  { to: '/precios', clave: 'precios', desliza: true },
  { to: '/registro', clave: 'registro', desliza: true },
  { to: '/terminos', clave: 'terminos' },
  { to: '/privacidad', clave: 'privacidad' },
]

const textos = {
  es: {
    precios: 'Precios',
    registro: 'Crear cuenta',
    terminos: 'Términos',
    privacidad: 'Privacidad',
    pie: 'Pie de página',
    lugar: 'Lima, Perú',
  },
  en: {
    precios: 'Pricing',
    registro: 'Sign up',
    terminos: 'Terms',
    privacidad: 'Privacy',
    pie: 'Footer',
    lugar: 'Lima, Peru',
  },
}

const redes = [
  { href: 'https://instagram.com/acecam', label: 'Instagram' },
  { href: 'https://tiktok.com/@acecam', label: 'TikTok' },
]

export default function PublicFooter() {
  const t = useTextos(textos)
  return (
    <footer className="border-t border-line px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <Logo rebota />

        <nav aria-label={t.pie}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text2 sm:gap-x-6">
            {links.map(({ desliza, ...link }) => {
              const Enlace = desliza ? LinkDeslizante : Link
              return (
                <li key={link.to}>
                  <Enlace to={link.to} className="hover:text-text">
                    {t[link.clave]}
                  </Enlace>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      <div className="mx-auto mt-4 flex max-w-6xl flex-col gap-2 border-t border-line pt-4 text-xs text-muted sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-5">
        <p>
          © {year} AceCam · {t.lugar}
        </p>
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
