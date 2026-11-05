import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { useTheme } from '../../../compartido/hooks/useTheme.js'
import { useIdioma, useTextos } from '../../../compartido/lib/idioma.jsx'
import { incluyeSeccion, PLANES_VISTA, usePlanVista } from '../../context/PlanVistaContext.js'

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
    nombrePlan: 'Plan',
    uso: (usados, limite) =>
      limite == null
        ? `${usados} análisis este mes`
        : `${usados} de ${limite} análisis usados este mes`,
    sinLimite: 'Sin límite',
    verComo: 'Ver como',
    planReal: 'Usar mi plan real',
    cambiarVista: (plan) => `Ver el panel como plan ${plan}`,
    desdePro: 'Disponible desde el plan Pro',
    sinPlan: 'Sin plan',
    eligePlan: 'Elige un plan para empezar',
    elegirPlan: 'Elegir plan',
    cerrarMenu: 'Cerrar menú',
    idioma: 'Idioma',
    tema: 'Tema',
    claro: 'Claro',
    oscuro: 'Oscuro',
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
    nombrePlan: 'Plan',
    uso: (usados, limite) =>
      limite == null
        ? `${usados} analyses this month`
        : `${usados} of ${limite} analyses used this month`,
    sinLimite: 'No limit',
    verComo: 'View as',
    planReal: 'Use my real plan',
    cambiarVista: (plan) => `View the panel as the ${plan} plan`,
    desdePro: 'Available from the Pro plan',
    sinPlan: 'No plan',
    eligePlan: 'Choose a plan to get started',
    elegirPlan: 'Choose a plan',
    cerrarMenu: 'Close menu',
    idioma: 'Language',
    tema: 'Theme',
    claro: 'Light',
    oscuro: 'Dark',
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

export default function BarraLateral({ movil = false, onCerrar }) {
  const t = useTextos(textos)
  const { idioma, cambiarIdioma } = useIdioma()
  const { toggleTheme, isLight } = useTheme()
  const [colapsado, setColapsado] = useState(leerColapsado)
  const { plan, planVista, setPlanVista, uso } = usePlanVista()
  const usados = uso.usados ?? 0
  const porcentaje = uso.limite ? Math.min(100, Math.round((usados / uso.limite) * 100)) : 0
  const sinPlan = plan === 'ninguno'
  const textoUso = sinPlan ? t.eligePlan : t.uso(usados, uso.limite)
  const motivo = sinPlan ? t.eligePlan : t.desdePro
  const actual = PLANES_VISTA.find((opcion) => opcion.id === plan)
  const siguiente = PLANES_VISTA[(PLANES_VISTA.indexOf(actual) + 1) % PLANES_VISTA.length]

  useEffect(() => {
    try {
      localStorage.setItem(CLAVE, colapsado ? 'colapsado' : 'abierto')
    } catch {
      return
    }
  }, [colapsado])

  const abierto = !colapsado
  const texto = movil ? 'truncate' : abierto ? 'sr-only lg:not-sr-only lg:truncate' : 'sr-only'
  const alElegir = movil ? onCerrar : undefined

  return (
    <aside
      className={
        movil
          ? 'flex h-full w-full flex-col gap-6 overflow-x-hidden overflow-y-auto bg-side px-3.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(100lvh-100svh+max(1.25rem,env(safe-area-inset-bottom)))]'
          : `sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 overflow-x-hidden overflow-y-auto border-r border-chip bg-side px-3.5 py-5 transition-[width] duration-300 md:flex ${
              abierto ? 'w-19 lg:w-58' : 'w-19'
            }`
      }
    >
      <button
        type="button"
        onClick={movil ? onCerrar : () => setColapsado((actual) => !actual)}
        aria-label={movil ? t.cerrarMenu : abierto ? t.colapsar : t.expandir}
        aria-expanded={movil ? undefined : abierto}
        title={movil ? t.cerrarMenu : abierto ? t.colapsar : t.expandir}
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
              movil
                ? ''
                : abierto
                  ? 'scale-x-60 opacity-50 lg:scale-x-100 lg:opacity-100'
                  : 'scale-x-60 opacity-50'
            }`}
          />
          <g
            className={`transition-[translate] duration-500 ease-[cubic-bezier(0.3,1.5,0.5,1)] ${
              movil ? '' : abierto ? '-translate-y-1 lg:translate-y-0' : '-translate-y-1'
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
        {movil ? (
          <span className="ml-auto grid size-9 place-items-center rounded-full bg-surface2 text-text2">
            <Trazo size={18}>
              <path d="M6 6l12 12M18 6L6 18" />
            </Trazo>
          </span>
        ) : (
          <span
            className={`ml-auto text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
              abierto ? 'hidden lg:block' : 'hidden'
            }`}
          >
            <Trazo size={18}>
              <path d="m14.5 7-5 5 5 5" />
            </Trazo>
          </span>
        )}
      </button>

      <nav aria-label={t.principal}>
        <ul className="flex flex-col gap-1">
          {secciones.map((seccion) =>
            incluyeSeccion(plan, seccion.clave) ? (
              <li key={seccion.to}>
                <NavLink
                  to={seccion.to}
                  onClick={alElegir}
                  title={abierto || movil ? undefined : t[seccion.clave]}
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
            ) : (
              <li key={seccion.to}>
                <Link
                  to={sinPlan ? seccion.to : '/configuracion?seccion=plan'}
                  onClick={alElegir}
                  title={`${t[seccion.clave]} · ${motivo}`}
                  aria-label={`${t[seccion.clave]}. ${motivo}`}
                  className="relative flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 text-[15px] font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface2 hover:text-text2"
                >
                  <Trazo className="opacity-60">{seccion.icono}</Trazo>
                  <span className={`${texto} opacity-70`}>{t[seccion.clave]}</span>
                  <span
                    aria-hidden="true"
                    className={`ml-auto shrink-0 items-center rounded-[4px] border border-line2 px-1 py-0.5 font-display text-[9px] leading-none font-bold tracking-[0.06em] text-text2 uppercase ${
                      movil ? 'inline-flex' : abierto ? 'hidden lg:inline-flex' : 'hidden'
                    }`}
                  >
                    {sinPlan ? (
                      <Trazo size={10} strokeWidth={2.6}>
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V8a4 4 0 018 0v3" />
                      </Trazo>
                    ) : (
                      'Pro'
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`absolute top-2 right-2 grid size-4 place-items-center rounded-full bg-surface2 text-text2 ${
                      movil ? 'hidden' : abierto ? 'lg:hidden' : ''
                    }`}
                  >
                    <Trazo size={9} strokeWidth={2.6}>
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 018 0v3" />
                    </Trazo>
                  </span>
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>

      <div
        role="img"
        aria-label={`${t.plan} ${actual?.nombre ?? (sinPlan ? t.sinPlan : '')}. ${textoUso}`}
        title={`${actual?.nombre ?? (sinPlan ? t.sinPlan : t.nombrePlan)} · ${textoUso}`}
        className={`mt-auto flex flex-col items-center gap-2 rounded-xl border border-line bg-surface py-3 ${movil ? 'hidden' : abierto ? 'lg:hidden' : ''}`}
      >
        <button
          type="button"
          onClick={() => setPlanVista(siguiente.id)}
          aria-label={t.cambiarVista(siguiente.nombre)}
          title={t.cambiarVista(siguiente.nombre)}
          className="cursor-pointer rounded-[5px] bg-accent px-1.5 py-0.5 font-display text-[11px] leading-none font-bold tracking-[0.06em] text-on-accent uppercase transition-opacity hover:opacity-85"
        >
          {actual?.nombre ?? (sinPlan ? '—' : 'Pro')}
        </button>
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
            strokeDasharray={`${sinPlan ? 0 : uso.limite ? porcentaje : 100} 100`}
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
            {usados}
          </text>
        </svg>
        <span className="text-[11px] leading-none font-semibold text-muted">
          {sinPlan ? t.sinPlan : uso.limite ? `/ ${uso.limite}` : t.sinLimite}
        </span>
      </div>

      <div
        className={`mt-auto flex-col gap-1.5 rounded-xl border border-line bg-surface p-3.5 ${
          movil ? 'flex' : abierto ? 'hidden lg:flex' : 'hidden'
        }`}
      >
        <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{t.plan}</p>
        <p className="font-semibold">
          {actual ? actual.nombre : sinPlan ? t.sinPlan : t.nombrePlan}
        </p>
        <p className="text-[13px] text-muted">{textoUso}</p>
        {sinPlan && (
          <Link
            to="/inicio"
            onClick={alElegir}
            className="mt-1 inline-flex min-h-9 items-center justify-center rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            {t.elegirPlan}
          </Link>
        )}
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-electric transition-[width] duration-500"
            style={{ width: `${sinPlan ? 0 : uso.limite ? porcentaje : 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5 border-t border-chip pt-2.5">
          <span className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
            {t.verComo}
          </span>
          <div
            role="group"
            aria-label={t.verComo}
            className="grid grid-cols-3 gap-0.5 rounded-lg border border-line bg-bg p-0.5"
          >
            {PLANES_VISTA.map((plan) => (
              <button
                key={plan.id}
                type="button"
                aria-pressed={planVista === plan.id}
                onClick={() => setPlanVista(planVista === plan.id ? null : plan.id)}
                title={planVista === plan.id ? t.planReal : t.cambiarVista(plan.nombre)}
                className="min-h-7 cursor-pointer rounded-md px-2 text-[12px] font-semibold text-text2 transition-colors hover:text-text aria-pressed:bg-accent aria-pressed:text-on-accent"
              >
                {plan.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      {movil && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={cambiarIdioma}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 text-[14px] font-medium text-text2"
          >
            {t.idioma}
            <span className="font-display text-[13px] font-bold tracking-[0.06em] text-text">
              {idioma === 'es' ? 'ES' : 'EN'}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 text-[14px] font-medium text-text2"
          >
            {t.tema}
            <span className="text-[13px] font-semibold text-text">
              {isLight ? t.claro : t.oscuro}
            </span>
          </button>
        </div>
      )}
    </aside>
  )
}
