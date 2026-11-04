import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import Button from '../../compartido/components/Button.jsx'
import LinkDeslizante from '../../compartido/components/LinkDeslizante.jsx'
import Logo from '../../compartido/components/Logo.jsx'
import ControlsPill from '../../compartido/components/ControlsPill.jsx'
import { useAterrizaje } from '../../compartido/hooks/useAterrizaje.js'
import { useTextos } from '../../compartido/lib/idioma.jsx'
import './acceso.css'

const opciones = [
  { to: '/login', clave: 'login' },
  { to: '/registro', clave: 'registro' },
]

const textos = {
  es: {
    login: 'Iniciar sesión',
    registro: 'Crear cuenta',
    acceso: 'Acceso',
    inicio: 'AceCam, ir al inicio',
  },
  en: { login: 'Log in', registro: 'Sign up', acceso: 'Access', inicio: 'AceCam, go to home' },
}

function Fondo() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(color-mix(in srgb, var(--line3) 45%, transparent) 1.2px, transparent 1.4px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 45%, black 20%, transparent 90%)',
        }}
      />
      <svg
        viewBox="0 0 368 218"
        className="absolute bottom-0 left-1/2 w-[min(1150px,170vw,150vh)] -translate-x-1/2"
        style={{ maskImage: 'linear-gradient(to top, black 45%, rgb(0 0 0 / 0.45))' }}
        fill="none"
        stroke="var(--electric)"
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path
          vectorEffect="non-scaling-stroke"
          d="M4 213.6L364 213.6M108.8 4L259.2 4M4 213.6L108.8 4M364 213.6L259.2 4M49 213.6L127.6 4M319 213.6L240.4 4M81.8 126L286.2 126M118.8 27.3L249.2 27.3M184 126L184 27.3M184 213.6L184 207.2M184 5.1L184 4"
        />
        <path
          vectorEffect="non-scaling-stroke"
          d="M66.1 65.8L301.9 65.8"
          strokeWidth="2.2"
          strokeOpacity="0.55"
        />
      </svg>
    </div>
  )
}

export default function Acceso() {
  const { pathname, state } = useLocation()
  const navigate = useNavigate()
  const registro = pathname === '/registro'
  const t = useTextos(textos)
  const contenido = useRef(null)
  const [alto, setAlto] = useState()
  const [cambio, setCambio] = useState(null)
  const [boton, setBoton] = useState(null)
  const contexto = useMemo(() => ({ setBoton }), [])
  const aterrizaje = useAterrizaje()

  useLayoutEffect(() => {
    const caja = contenido.current
    if (!caja || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => setAlto(caja.offsetHeight))
    observador.observe(caja)
    return () => observador.disconnect()
  }, [])

  const cambiar = (to) => {
    setCambio(to === '/registro' ? 'derecha' : 'izquierda')
    navigate(to, { replace: true, state })
  }

  return (
    <div
      className={`relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 text-text ${registro ? 'py-6' : 'py-10'}`}
    >
      <Fondo />
      <ControlsPill ocultarIngreso />
      <div className="relative w-full max-w-md">
        <LinkDeslizante
          to="/"
          sentido="atras"
          {...aterrizaje}
          className={`mx-auto flex w-fit ${registro ? 'mb-4' : 'mb-5'}`}
          aria-label={t.inicio}
        >
          <Logo size={76} wordmarkClassName="text-6xl" className="gap-3.5" rebota />
        </LinkDeslizante>
        <div
          className={`rounded-card border border-line bg-surface transition-[padding] duration-500 ${registro ? 'p-5 sm:p-7' : 'p-6 sm:p-8'}`}
        >
          <div
            role="tablist"
            aria-label={t.acceso}
            className={`relative grid grid-cols-2 rounded-full bg-surface2 p-1 ${registro ? 'mb-5' : 'mb-7'}`}
          >
            <span
              aria-hidden="true"
              className="acceso-indicador absolute inset-y-1 left-1 w-[calc(50%-4px)]"
              style={{ transform: registro ? 'translateX(100%)' : 'none' }}
            >
              <span
                key={cambio ? pathname : 'inicio'}
                className={`block size-full rounded-full bg-accent shadow-[0_4px_14px_-4px_var(--accent)] ${
                  cambio ? 'acceso-estirar' : ''
                }`}
                style={{ transformOrigin: registro ? 'left' : 'right' }}
              />
            </span>
            {opciones.map((opcion) => {
              const activa = pathname === opcion.to
              return (
                <button
                  key={opcion.to}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => !activa && cambiar(opcion.to)}
                  className={`relative z-10 cursor-pointer rounded-full py-2 text-sm font-semibold transition-colors duration-300 ${
                    activa ? 'text-on-accent' : 'text-text2 hover:text-text'
                  }`}
                >
                  {t[opcion.clave]}
                </button>
              )
            })}
          </div>
          <div className="acceso-alto overflow-hidden" style={{ height: alto }}>
            <div ref={contenido}>
              <div
                key={pathname}
                data-desde={cambio ?? undefined}
                className={cambio ? 'acceso-entrar' : undefined}
              >
                <Outlet context={contexto} />
              </div>
            </div>
          </div>
          <Button
            key={cambio ? boton?.label : 'boton'}
            type="submit"
            form="acceso-form"
            size="lg"
            disabled={!boton || boton.disabled}
            className={`acceso-boton w-full overflow-hidden ${registro ? 'mt-5' : 'mt-6'}`}
          >
            <span key={boton?.label} className={cambio ? 'acceso-texto block' : 'block'}>
              {boton?.label}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
