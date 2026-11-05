import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import Avatar from '../../panel/components/Avatar.jsx'
import { useAvatar } from '../../panel/hooks/useAvatar.js'

const textos = {
  es: {
    cuenta: 'Tu cuenta',
    panel: 'Ir al panel',
    configuracion: 'Configuración',
    plan: 'Plan y facturación',
    salir: 'Cerrar sesión',
  },
  en: {
    cuenta: 'Your account',
    panel: 'Go to dashboard',
    configuracion: 'Settings',
    plan: 'Plan and billing',
    salir: 'Log out',
  },
}

const opciones = [
  {
    clave: 'panel',
    to: '/inicio',
    icono: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
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
]

const claseOpcion =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-text2 transition-colors hover:bg-surface2 hover:text-text'

function Trazo({ children }) {
  return (
    <svg
      width="18"
      height="18"
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

export default function MenuCuenta({ idioma, nombre, correo, onSalir }) {
  const t = textos[idioma]
  const { indice } = useAvatar(correo)
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

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-label={t.cuenta}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        onClick={() => setAbierto((actual) => !actual)}
        className="ml-0.5 grid size-9 cursor-pointer place-items-center rounded-full transition-[box-shadow] hover:ring-2 hover:ring-line3 aria-expanded:ring-2 aria-expanded:ring-electric"
      >
        <Avatar nombre={nombre} indice={indice} className="size-9" texto="text-xs" />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label={t.cuenta}
          className="absolute top-full right-0 z-50 mt-3 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-line2 bg-surface shadow-tile"
        >
          <div className="flex items-center gap-3 px-4 py-4">
            <span aria-hidden="true" className="shrink-0">
              <Avatar nombre={nombre} indice={indice} className="size-11" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate font-semibold">{nombre}</p>
              <p className="truncate text-[13px] text-muted">{correo}</p>
            </div>
          </div>
          <ul className="border-t border-chip p-1.5">
            {opciones.map((opcion) => (
              <li key={opcion.clave}>
                <Link to={opcion.to} onClick={() => setAbierto(false)} className={claseOpcion}>
                  <Trazo>{opcion.icono}</Trazo>
                  {t[opcion.clave]}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-chip p-1.5">
            <button
              type="button"
              onClick={() => {
                setAbierto(false)
                onSalir()
              }}
              className={`${claseOpcion} text-bad hover:bg-bad/10 hover:text-bad`}
            >
              <Trazo>
                <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" />
                <path d="M10 17l-5-5 5-5" />
                <path d="M5 12h11" />
              </Trazo>
              {t.salir}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
