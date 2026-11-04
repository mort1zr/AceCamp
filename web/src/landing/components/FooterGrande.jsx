import { Link } from 'react-router'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import Icon from './Icon.jsx'
import LinkDeslizante from '../../compartido/components/LinkDeslizante.jsx'

const year = new Date().getFullYear()

const columnas = [
  [
    { to: '/', clave: 'inicio', desliza: true, sentido: 'atras' },
    { to: '/precios', clave: 'precios', actual: true },
    { to: '/registro', clave: 'registro', desliza: true },
  ],
  [
    { to: '/terminos', clave: 'terminos' },
    { to: '/privacidad', clave: 'privacidad' },
    { href: 'mailto:consultas@acecam.com', clave: 'contacto' },
  ],
]

const textos = {
  es: {
    inicio: 'Inicio',
    precios: 'Precios',
    registro: 'Crear cuenta',
    terminos: 'Términos',
    privacidad: 'Privacidad',
    contacto: 'Contacto',
    sigue: 'Sigue a AceCam',
    novedades: 'con todas sus novedades',
    pie: 'Pie de página',
    lugar: 'Lima, Perú',
  },
  en: {
    inicio: 'Home',
    precios: 'Pricing',
    registro: 'Sign up',
    terminos: 'Terms',
    privacidad: 'Privacy',
    contacto: 'Contact',
    sigue: 'Follow AceCam',
    novedades: 'and all its updates',
    pie: 'Footer',
    lugar: 'Lima, Peru',
  },
}

const redes = [
  { href: 'https://instagram.com/acecam', label: 'Instagram', icon: 'instagram' },
  { href: 'https://tiktok.com/@acecam', label: 'TikTok', icon: 'tiktok' },
]

function Enlace({ enlace, texto }) {
  const clases = `transition-colors ${enlace.actual ? 'text-accent-ink' : 'text-text hover:text-accent-ink'}`
  if (enlace.href) {
    return (
      <a href={enlace.href} className={clases}>
        {texto}
      </a>
    )
  }
  if (enlace.desliza) {
    return (
      <LinkDeslizante to={enlace.to} sentido={enlace.sentido} className={clases}>
        {texto}
      </LinkDeslizante>
    )
  }
  return (
    <Link to={enlace.to} aria-current={enlace.actual ? 'page' : undefined} className={clases}>
      {texto}
    </Link>
  )
}

export default function FooterGrande() {
  const t = useTextos(textos)
  return (
    <footer className="relative overflow-hidden">
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col gap-12 px-6 pt-24 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-4xl leading-tight sm:text-5xl">
            {t.sigue}
            <br />
            {t.novedades}
          </p>
          <ul className="mt-6 flex gap-3">
            {redes.map((red) => (
              <li key={red.label}>
                <a
                  href={red.href}
                  aria-label={red.label}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="grid size-11 place-content-center rounded-full border border-line3 text-accent-ink transition-colors hover:border-accent-line"
                >
                  <Icon name={red.icon} size={20} strokeWidth={2} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav
          aria-label={t.pie}
          className="flex gap-16 border-l border-line3 pl-8 text-base font-medium"
        >
          {columnas.map((columna, indice) => (
            <ul key={indice} className="space-y-3">
              {columna.map((enlace) => (
                <li key={enlace.clave}>
                  <Enlace enlace={enlace} texto={t[enlace.clave]} />
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none mt-12 flex items-center justify-center gap-[2vw] whitespace-nowrap text-line2 select-none"
      >
        <svg viewBox="2 3.5 26 23" className="w-[24vw] shrink-0">
          <path d="M3 25h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="15" cy="24.6" rx="6" ry="1.6" fill="var(--line3)" />
          <circle cx="15" cy="12" r="7.5" fill="currentColor" />
          <path
            d="M9.6 7.4c2.9 2.4 2.9 6.8 0 9.2M20.4 7.4c-2.9 2.4-2.9 6.8 0 9.2"
            stroke="var(--surface)"
            strokeWidth="1.4"
            fill="none"
          />
        </svg>
        <span className="font-display text-[24vw] leading-none font-bold tracking-tight">
          AceCam
        </span>
      </div>

      <p className="py-6 text-center text-xs text-muted">
        © {year} AceCam · {t.lugar}
      </p>
    </footer>
  )
}
