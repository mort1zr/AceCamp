import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useTextos } from '../../lib/idioma.jsx'
import Logo from '../Logo.jsx'

const CLAVE = 'acecam-menu'

const secciones = [
  {
    to: '/inicio',
    clave: 'inicio',
    icono: (
      <>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    to: '/dashboard',
    clave: 'dashboard',
    icono: (
      <>
        <path d="M3 20h18" />
        <path d="M6 16v-5" />
        <path d="M11 16V6" />
        <path d="M16 16v-8" />
        <path d="M21 16v-3" />
      </>
    ),
  },
  {
    to: '/jugadores',
    clave: 'jugadores',
    icono: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.9 6.5 5.5" />
        <path d="M16 4.6a3.5 3.5 0 010 6.8" />
        <path d="M21.5 20c0-2.6-1.4-4.3-3.5-5" />
      </>
    ),
  },
  {
    to: '/analizar',
    clave: 'analizar',
    icono: (
      <>
        <path d="M12 15V4" />
        <path d="M7 9l5-5 5 5" />
        <path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" />
      </>
    ),
  },
  {
    to: '/partidos',
    clave: 'partidos',
    icono: (
      <>
        <rect x="3" y="5" width="13" height="14" rx="2" />
        <path d="M16 10l5-3v10l-5-3" />
      </>
    ),
  },
  {
    to: '/comparador',
    clave: 'comparador',
    icono: (
      <>
        <rect x="3" y="4" width="7" height="16" rx="1.5" />
        <rect x="14" y="4" width="7" height="16" rx="1.5" />
      </>
    ),
  },
  {
    to: '/reclutamiento',
    clave: 'reclutamiento',
    icono: (
      <>
        <path d="M3 13l2.6-7.4A1 1 0 016.5 5h11a1 1 0 01.9.6L21 13v6a1 1 0 01-1 1H4a1 1 0 01-1-1z" />
        <path d="M3 13h5l1.5 2.5h5L16 13h5" />
      </>
    ),
  },
  {
    to: '/configuracion',
    clave: 'configuracion',
    icono: (
      <>
        <path d="M4 6h9" />
        <path d="M19 6h1" />
        <circle cx="16" cy="6" r="2.5" />
        <path d="M4 12h3" />
        <path d="M13 12h7" />
        <circle cx="10" cy="12" r="2.5" />
        <path d="M4 18h11" />
        <circle cx="18" cy="18" r="2.5" />
      </>
    ),
  },
]

const textos = {
  es: {
    inicio: 'Inicio',
    dashboard: 'Dashboard',
    jugadores: 'Jugadores',
    analizar: 'Analizar video',
    partidos: 'Partidos',
    comparador: 'Comparador',
    reclutamiento: 'Reclutamiento',
    configuracion: 'Configuración',
    principal: 'Principal',
    irInicio: 'AceCam, ir a Inicio',
    colapsar: 'Colapsar menú',
    expandir: 'Expandir menú',
    plan: 'Plan',
    nombrePlan: 'Universidad · Pro',
    uso: '18 de 40 análisis usados este mes',
  },
  en: {
    inicio: 'Home',
    dashboard: 'Dashboard',
    jugadores: 'Players',
    analizar: 'Analyze video',
    partidos: 'Matches',
    comparador: 'Compare',
    reclutamiento: 'Recruiting',
    configuracion: 'Settings',
    principal: 'Main',
    irInicio: 'AceCam, go to Home',
    colapsar: 'Collapse menu',
    expandir: 'Expand menu',
    plan: 'Plan',
    nombrePlan: 'University · Pro',
    uso: '18 of 40 analyses used this month',
  },
}

function leerColapsado() {
  try {
    return localStorage.getItem(CLAVE) === 'colapsado'
  } catch {
    return false
  }
}

function Trazo({ children, className = '' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

export default function BarraLateral() {
  const t = useTextos(textos)
  const [colapsado, setColapsado] = useState(leerColapsado)

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, colapsado ? 'colapsado' : 'abierto')
    } catch {
      return
    }
  }, [colapsado])

  const abierto = !colapsado
  const texto = abierto ? 'sr-only lg:not-sr-only lg:truncate' : 'sr-only'

  return (
    <aside
      className={`sticky top-0 flex h-dvh shrink-0 flex-col gap-6 overflow-x-hidden overflow-y-auto border-r border-chip bg-side px-3.5 py-5 transition-[width] duration-300 ${
        abierto ? 'w-19 lg:w-58' : 'w-19'
      }`}
    >
      <Link
        to="/inicio"
        aria-label={t.irInicio}
        className="flex items-center gap-2.5 px-2 py-1 text-text"
      >
        <Logo size={30} withWordmark={false} className="shrink-0" />
        <span
          className={`font-display text-[26px] leading-none font-bold tracking-[0.08em] ${texto}`}
        >
          AceCam
        </span>
      </Link>

      <nav aria-label={t.principal}>
        <ul className="flex flex-col gap-1">
          {secciones.map((seccion) => (
            <li key={seccion.to}>
              <NavLink
                to={seccion.to}
                title={abierto ? undefined : t[seccion.clave]}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-accent font-semibold text-on-accent'
                      : 'font-medium text-text2 hover:bg-surface2 hover:text-text'
                  }`
                }
              >
                <Trazo>{seccion.icono}</Trazo>
                <span className={texto}>{t[seccion.clave]}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div
          className={`flex-col gap-1.5 rounded-xl border border-line bg-surface p-3.5 ${
            abierto ? 'hidden lg:flex' : 'hidden'
          }`}
        >
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{t.plan}</p>
          <p className="font-semibold">{t.nombrePlan}</p>
          <p className="text-[13px] text-muted">{t.uso}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full w-[45%] rounded-full bg-electric" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setColapsado((actual) => !actual)}
          aria-label={abierto ? t.colapsar : t.expandir}
          aria-expanded={abierto}
          title={abierto ? t.colapsar : t.expandir}
          className="hidden min-h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface2 hover:text-text lg:flex"
        >
          <Trazo className={`transition-transform duration-300 ${abierto ? '' : 'rotate-180'}`}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
            <path d="M15.5 10l-2 2 2 2" />
          </Trazo>
          <span className={texto}>{abierto ? t.colapsar : t.expandir}</span>
        </button>
      </div>
    </aside>
  )
}
