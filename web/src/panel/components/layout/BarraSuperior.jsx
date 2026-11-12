import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Avatar from '../Avatar.jsx'
import { useAvatar } from '../../hooks/useAvatar.js'
import { useTheme } from '../../../compartido/hooks/useTheme.js'
import { useIdioma } from '../../../compartido/lib/idioma.jsx'

const textos = {
  es: {
    barra: 'Barra superior',
    menu: 'Abrir menú',
    abrirBuscador: 'Buscar',
    cerrarBuscador: 'Cerrar búsqueda',
    buscar: 'Buscar jugador',
    placeholder: 'Buscar jugador, academia o torneo',
    temaOscuro: 'Cambiar a tema oscuro',
    temaClaro: 'Cambiar a tema claro',
    idioma: 'Cambiar idioma a inglés',
    avisos: 'Notificaciones',
    sinLeer: (n) => `${n} sin leer`,
    tituloAvisos: 'Notificaciones',
    marcarLeidas: 'Marcar como leídas',
    sinAvisos: 'No tienes avisos',
    sinAvisosTexto: 'Aquí verás cuando termine un análisis o llegue una postulación.',
    usuario: 'Coach',
    organizacion: 'Tu equipo',
    cuenta: 'Tu cuenta',
    configuracion: 'Configuración',
    perfil: 'Mi perfil',
    plan: 'Plan y facturación',
    ayuda: 'Ayuda y soporte',
    sitio: 'Ir al sitio de AceCam',
    salir: 'Cerrar sesión',
  },
  en: {
    barra: 'Top bar',
    menu: 'Open menu',
    abrirBuscador: 'Search',
    cerrarBuscador: 'Close search',
    buscar: 'Search player',
    placeholder: 'Search player, academy or tournament',
    temaOscuro: 'Switch to dark theme',
    temaClaro: 'Switch to light theme',
    idioma: 'Cambiar idioma a español',
    avisos: 'Notifications',
    sinLeer: (n) => `${n} unread`,
    tituloAvisos: 'Notifications',
    marcarLeidas: 'Mark as read',
    sinAvisos: 'No notifications',
    sinAvisosTexto: 'You’ll see here when an analysis finishes or an application arrives.',
    usuario: 'Coach',
    organizacion: 'Your team',
    cuenta: 'Your account',
    configuracion: 'Settings',
    perfil: 'My profile',
    plan: 'Plan and billing',
    ayuda: 'Help and support',
    sitio: 'Go to the AceCam site',
    salir: 'Log out',
  },
}

const botonIcono =
  'relative inline-grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] border border-line bg-surface text-text3 transition-colors hover:border-line3 hover:text-text'

const claseOpcion =
  'flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text'

const opcionesCuenta = [
  {
    clave: 'perfil',
    to: '/configuracion?seccion=cuenta',
    icono: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </>
    ),
  },
  {
    clave: 'configuracion',
    to: '/configuracion',
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
  {
    clave: 'plan',
    to: '/configuracion?seccion=plan',
    icono: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  },
  {
    clave: 'ayuda',
    href: 'mailto:consultas@acecam.com',
    icono: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 014.9.7c0 1.7-2.4 2.2-2.4 3.8M12 17h.01" />
      </>
    ),
  },
  {
    clave: 'sitio',
    to: '/',
    icono: (
      <>
        <path d="M14 4h6v6" />
        <path d="M20 4l-9 9" />
        <path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
      </>
    ),
  },
]

function Trazo({ children, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function useDesplegable() {
  const [abierto, setAbierto] = useState(false)
  const caja = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (evento) => {
      if (evento.type === 'keydown' && evento.key !== 'Escape') return
      if (evento.type === 'pointerdown' && caja.current?.contains(evento.target)) return
      setAbierto(false)
    }
    document.addEventListener('pointerdown', cerrar)
    document.addEventListener('keydown', cerrar)
    return () => {
      document.removeEventListener('pointerdown', cerrar)
      document.removeEventListener('keydown', cerrar)
    }
  }, [abierto])

  return { abierto, setAbierto, caja }
}

function Cuenta({ t, nombre, correo, organizacion, onSalir }) {
  const { indice } = useAvatar(correo)
  const { abierto, setAbierto, caja } = useDesplegable()
  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label={t.cuenta}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => setAbierto((actual) => !actual)}
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-[box-shadow] hover:ring-2 hover:ring-line3 aria-expanded:ring-2 aria-expanded:ring-electric"
      >
        <Avatar nombre={nombre} indice={indice} className="size-10" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={t.cuenta}
          className="absolute top-full right-0 z-40 mt-2 w-64 max-w-[calc(100vw-2rem)] max-md:fixed max-md:top-[calc(4.25rem+env(safe-area-inset-top))] max-md:right-4 max-md:left-auto overflow-hidden rounded-card border border-line2 bg-surface shadow-tile"
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <span aria-hidden="true" className="shrink-0">
              <Avatar nombre={nombre} indice={indice} className="size-11" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">{nombre}</p>
              <p className="truncate text-[13px] text-muted">{organizacion}</p>
            </div>
          </div>
          <ul className="border-t border-chip p-1.5">
            {opcionesCuenta.map((opcion) => (
              <li key={opcion.clave}>
                {opcion.href ? (
                  <a href={opcion.href} onClick={() => setAbierto(false)} className={claseOpcion}>
                    <Trazo size={18}>{opcion.icono}</Trazo>
                    {t[opcion.clave]}
                  </a>
                ) : (
                  <Link to={opcion.to} onClick={() => setAbierto(false)} className={claseOpcion}>
                    <Trazo size={18}>{opcion.icono}</Trazo>
                    {t[opcion.clave]}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-chip p-1.5">
            <Link
              to="/login"
              onClick={() => {
                setAbierto(false)
                onSalir()
              }}
              className={`${claseOpcion} text-bad hover:bg-bad/10 hover:text-bad`}
            >
              <Trazo size={18}>
                <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
                <path d="M10 17l-5-5 5-5" />
                <path d="M5 12h11" />
              </Trazo>
              {t.salir}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function Avisos({ t, avisos, onLeer }) {
  const { abierto, setAbierto, caja } = useDesplegable()
  const noLeidos = avisos.filter((aviso) => !aviso.leido).length

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label={noLeidos ? `${t.avisos}, ${t.sinLeer(noLeidos)}` : t.avisos}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => setAbierto((actual) => !actual)}
        className={botonIcono}
      >
        <Trazo>
          <path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" />
          <path d="M10 20a2 2 0 004 0" />
        </Trazo>
        {noLeidos > 0 && (
          <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-series1 ring-2 ring-surface" />
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={t.tituloAvisos}
          className="absolute top-full right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] max-md:fixed max-md:top-[calc(4.25rem+env(safe-area-inset-top))] max-md:right-4 max-md:left-4 max-md:w-auto max-md:max-w-none overflow-hidden rounded-card border border-line2 bg-surface shadow-tile"
        >
          <div className="flex items-center justify-between gap-3 border-b border-chip px-4 py-3">
            <p className="font-display text-lg font-bold">{t.tituloAvisos}</p>
            {noLeidos > 0 && (
              <button
                type="button"
                onClick={onLeer}
                className="cursor-pointer text-[13px] font-semibold text-accent-ink hover:underline"
              >
                {t.marcarLeidas}
              </button>
            )}
          </div>
          {avisos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
              <span className="grid size-11 place-items-center rounded-full border border-line2 text-electric-ink">
                <Trazo>
                  <path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" />
                  <path d="M10 20a2 2 0 004 0" />
                </Trazo>
              </span>
              <p className="font-semibold">{t.sinAvisos}</p>
              <p className="max-w-[30ch] text-[13px] text-muted">{t.sinAvisosTexto}</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {avisos.map((aviso) => (
                <li
                  key={aviso.id}
                  className="flex gap-3 border-t border-chip px-4 py-3 first:border-t-0"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${aviso.leido ? 'bg-line2' : 'bg-series1'}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{aviso.titulo}</p>
                    {aviso.detalle && <p className="text-[13px] text-muted">{aviso.detalle}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function BarraSuperior({
  usuario,
  avisos = [],
  onLeerAvisos = () => {},
  onSalir = () => {},
  onMenu = () => {},
}) {
  const { idioma, cambiarIdioma } = useIdioma()
  const t = textos[idioma]
  const { toggleTheme, isLight } = useTheme()
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const nombre = usuario?.nombre || t.usuario
  const organizacion = usuario?.organizacion || t.organizacion
  const barra = useRef(null)

  useEffect(() => {
    const elemento = barra.current
    if (!elemento || typeof ResizeObserver !== 'function') return undefined
    const raiz = document.documentElement
    const medir = () => raiz.style.setProperty('--barra-alto', `${elemento.offsetHeight}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(elemento)
    return () => {
      observador.disconnect()
      raiz.style.removeProperty('--barra-alto')
    }
  }, [])

  const buscar = (evento) => {
    evento.preventDefault()
    const texto = busqueda.trim()
    navigate(texto ? `/jugadores?buscar=${encodeURIComponent(texto)}` : '/jugadores')
  }

  return (
    <header
      ref={barra}
      aria-label={t.barra}
      className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-chip bg-bg/90 px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5 backdrop-blur-md md:gap-3 md:px-6 md:py-3.5"
    >
      <button
        type="button"
        onClick={onMenu}
        aria-label={t.menu}
        title={t.menu}
        className={`${botonIcono} md:hidden`}
      >
        <Trazo>
          <path d="M4 7h16M4 12h16M4 17h10" />
        </Trazo>
      </button>

      <span className="flex items-center gap-2 md:hidden">
        <svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
          <path d="M3 25h24" stroke="var(--faint)" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="15" cy="24.6" rx="6" ry="1.6" fill="var(--series1)" />
          <circle cx="15" cy="12" r="7.5" fill="var(--accent)" />
          <path
            d="M9.6 7.4c2.9 2.4 2.9 6.8 0 9.2M20.4 7.4c-2.9 2.4-2.9 6.8 0 9.2"
            stroke="var(--on-accent)"
            strokeWidth="1.4"
            fill="none"
          />
        </svg>
        <span className="font-display text-[21px] leading-none font-bold tracking-[0.06em]">
          AceCam
        </span>
      </span>

      <form
        role="search"
        onSubmit={buscar}
        className={`relative min-w-0 items-center md:order-none md:flex md:max-w-105 md:flex-[1_1_240px] md:basis-auto ${
          buscando ? 'order-last flex basis-full pb-1' : 'hidden'
        }`}
      >
        <label htmlFor="panel-buscar" className="sr-only">
          {t.buscar}
        </label>
        <span className="pointer-events-none absolute left-3.5 text-muted">
          <Trazo size={18}>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </Trazo>
        </span>
        <input
          id="panel-buscar"
          type="search"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder={t.placeholder}
          className="h-11 w-full rounded-[10px] border border-line2 bg-surface pr-3.5 pl-10 text-[15px] text-text transition-colors placeholder:text-placeholder hover:border-line3 focus:border-accent-ink focus:ring-1 focus:ring-accent-ink focus:outline-none"
        />
      </form>

      <div className="flex-1" />

      <button
        type="button"
        onClick={() => {
          setBuscando((actual) => !actual)
          requestAnimationFrame(() => document.getElementById('panel-buscar')?.focus())
        }}
        aria-label={buscando ? t.cerrarBuscador : t.abrirBuscador}
        aria-expanded={buscando}
        aria-controls="panel-buscar"
        className={`${botonIcono} md:hidden ${buscando ? 'bg-surface2 text-text' : ''}`}
      >
        <Trazo>
          {buscando ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </>
          )}
        </Trazo>
      </button>

      <button
        type="button"
        onClick={cambiarIdioma}
        aria-label={t.idioma}
        title={t.idioma}
        className={`${botonIcono} font-display text-[13px] font-bold tracking-[0.06em] max-md:hidden`}
      >
        {idioma === 'es' ? 'ES' : 'EN'}
      </button>

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isLight ? t.temaOscuro : t.temaClaro}
        title={isLight ? t.temaOscuro : t.temaClaro}
        className={`${botonIcono} max-md:hidden`}
      >
        {isLight ? (
          <Trazo>
            <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
          </Trazo>
        ) : (
          <Trazo>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </Trazo>
        )}
      </button>

      <Avisos t={t} avisos={avisos} onLeer={onLeerAvisos} />

      <Cuenta
        t={t}
        nombre={nombre}
        correo={usuario?.correo}
        organizacion={organizacion}
        onSalir={onSalir}
      />
    </header>
  )
}
