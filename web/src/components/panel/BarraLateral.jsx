import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { useTextos } from '../../lib/idioma.jsx'

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

function Trazo({ children, className = '', size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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
      <button
        type="button"
        onClick={() => setColapsado((actual) => !actual)}
        aria-label={abierto ? t.colapsar : t.expandir}
        aria-expanded={abierto}
        title={abierto ? t.colapsar : t.expandir}
        className="group relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1 text-left text-text transition-colors hover:bg-surface2"
      >
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="shrink-0">
          <path d="M3 25h24" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" />
          <ellipse
            cx="15"
            cy="24.6"
            rx="6"
            ry="1.6"
            fill="var(--series1)"
            className={`origin-center transition-[scale,opacity] duration-500 [transform-box:fill-box] ${
              abierto
                ? 'scale-x-60 opacity-50 lg:scale-x-100 lg:opacity-100'
                : 'scale-x-60 opacity-50'
            }`}
          />
          <g
            className={`transition-[translate] duration-500 ease-[cubic-bezier(0.3,1.5,0.5,1)] ${
              abierto ? '-translate-y-1 lg:translate-y-0' : '-translate-y-1'
            }`}
          >
            <circle cx="15" cy="12" r="7.5" fill="var(--accent)" />
            <path
              d="M9.6 7.4c2.9 2.4 2.9 6.8 0 9.2M20.4 7.4c-2.9 2.4-2.9 6.8 0 9.2"
              stroke="var(--on-accent)"
              strokeWidth="1.4"
              fill="none"
            />
          </g>
        </svg>
        <span
          className={`font-display text-[26px] leading-none font-bold tracking-[0.08em] ${texto}`}
        >
          AceCam
        </span>
        <span
          className={`ml-auto text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
            abierto ? 'hidden lg:block' : 'hidden'
          }`}
        >
          <Trazo size={18}>
            <path d="m14.5 7-5 5 5 5" />
          </Trazo>
        </span>
      </button>

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

      <div
        role="img"
        aria-label={`${t.plan} ${t.nombrePlan}. ${t.uso}`}
        title={`${t.nombrePlan} · ${t.uso}`}
        className={`mt-auto flex flex-col items-center gap-2 rounded-xl border border-line bg-surface py-3 ${abierto ? 'lg:hidden' : ''}`}
      >
        <span className="rounded-[5px] bg-accent px-1.5 py-0.5 font-display text-[11px] leading-none font-bold tracking-[0.06em] text-on-accent uppercase">
          Pro
        </span>
        <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true" className="-rotate-90">
          <circle cx="21" cy="21" r="17" fill="none" stroke="var(--line2)" strokeWidth="4" />
          <circle
            cx="21"
            cy="21"
            r="17"
            fill="none"
            stroke="var(--electric)"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray="45 100"
          />
          <text
            x="21"
            y="21"
            transform="rotate(90 21 21)"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--text)"
            className="font-display text-[16px] font-bold"
          >
            18
          </text>
        </svg>
        <span className="text-[11px] leading-none font-semibold text-muted">/ 40</span>
      </div>

      <div
        className={`mt-auto flex-col gap-1.5 rounded-xl border border-line bg-surface p-3.5 ${
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
    </aside>
  )
}
