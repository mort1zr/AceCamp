import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useTextos } from '../lib/idioma.jsx'
import { irAlInicio } from '../lib/smoothScroll.js'
import Icon from './Icon.jsx'
import LinkDeslizante from './LinkDeslizante.jsx'

const TOPE = 16
const RELLENO = 6
const EXPANDIR_MS = 500
const CERRAR_MS = 220

const enlaces = [
  { to: '/', clave: 'inicio', className: 'hidden sm:block', alInicio: true },
  { to: '/precios', clave: 'precios', desliza: true },
  { to: '/login', clave: 'ingresar' },
]

const textos = {
  es: {
    inicio: 'Inicio',
    precios: 'Precios',
    ingresar: 'Ingresar',
    navegacion: 'Navegación principal',
    empezar: 'Empieza gratis',
  },
  en: {
    inicio: 'Home',
    precios: 'Pricing',
    ingresar: 'Log in',
    navegacion: 'Main navigation',
    empezar: 'Start free',
  },
}

export default function FloatingNav({ onExpandir }) {
  const { pathname } = useLocation()
  const t = useTextos(textos)
  const [visible, setVisible] = useState(false)
  const [expandido, setExpandido] = useState(false)
  const [anchoMenu, setAnchoMenu] = useState(0)
  const menuRef = useRef(null)
  const activo = useRef(false)

  useEffect(() => {
    onExpandir?.(expandido)
  }, [expandido, onExpandir])

  useEffect(() => {
    let frame = null
    let espera = null

    const mostrar = (boton) => {
      clearTimeout(espera)
      boton.style.visibility = 'hidden'
      setAnchoMenu(menuRef.current?.scrollWidth ?? 0)
      setVisible(true)
      espera = setTimeout(() => setExpandido(true), 20)
    }

    const ocultar = (boton) => {
      clearTimeout(espera)
      setExpandido(false)
      espera = setTimeout(() => {
        setVisible(false)
        boton.style.visibility = ''
      }, CERRAR_MS)
    }

    const medir = () => {
      frame = null
      const boton = document.querySelector('[data-nav-cta]')
      if (!boton) return
      const rect = boton.getBoundingClientRect()
      const llego = rect.top <= TOPE + RELLENO
      if (llego === activo.current) return
      activo.current = llego
      if (llego) mostrar(boton)
      else ocultar(boton)
    }

    const pedir = () => {
      if (frame === null) frame = requestAnimationFrame(medir)
    }

    pedir()
    window.addEventListener('scroll', pedir, { passive: true })
    window.addEventListener('resize', pedir)
    return () => {
      window.removeEventListener('scroll', pedir)
      window.removeEventListener('resize', pedir)
      if (frame !== null) cancelAnimationFrame(frame)
      clearTimeout(espera)
      const boton = document.querySelector('[data-nav-cta]')
      if (boton) boton.style.visibility = ''
    }
  }, [])

  return (
    <nav
      aria-label={t.navegacion}
      aria-hidden={!visible}
      className={`fixed z-40 flex items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-300 ${
        expandido
          ? 'border-line2 bg-surface2/90 shadow-tile backdrop-blur-lg'
          : 'border-transparent bg-transparent'
      } ${visible ? '' : 'pointer-events-none invisible'}`}
      style={{ top: TOPE, left: '50%', translate: '-50% 0', padding: RELLENO }}
    >
      <div
        className="overflow-hidden"
        style={{
          width: expandido ? anchoMenu : 0,
          transition: `width ${expandido ? EXPANDIR_MS : CERRAR_MS}ms ease`,
        }}
      >
        <ul ref={menuRef} className="flex w-max items-center gap-1 pr-2 pl-1">
          <li className="px-2">
            <span className="block size-2 rounded-full bg-accent" />
          </li>
          {enlaces.map(({ desliza, alInicio, ...enlace }) => {
            const Enlace = desliza ? LinkDeslizante : Link
            return (
              <li
                key={enlace.clave}
                className={`transition-opacity ${enlace.className ?? ''} ${
                  expandido ? 'opacity-100 duration-1000' : 'opacity-0 duration-150'
                }`}
              >
                <Enlace
                  to={enlace.to}
                  onClick={
                    alInicio && pathname === '/'
                      ? (evento) => {
                          evento.preventDefault()
                          irAlInicio()
                        }
                      : undefined
                  }
                  tabIndex={expandido ? undefined : -1}
                  className="block rounded-full px-3 py-2 text-[15px] font-medium whitespace-nowrap text-text2 transition-colors hover:text-text"
                >
                  {t[enlace.clave]}
                </Enlace>
              </li>
            )
          })}
        </ul>
      </div>

      <Link
        to="/registro"
        tabIndex={visible ? undefined : -1}
        className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold whitespace-nowrap text-on-accent transition-opacity hover:opacity-90"
      >
        <span
          className="h-1.5 rounded-full bg-on-accent"
          style={{
            width: expandido ? 0 : 6,
            marginRight: expandido ? -8 : 0,
            opacity: expandido ? 0 : 1,
            transition: `width ${EXPANDIR_MS}ms ease, margin ${EXPANDIR_MS}ms ease, opacity 200ms ease`,
          }}
        />
        {t.empezar}
        <span
          className="inline-flex overflow-hidden"
          style={{
            width: expandido ? 18 : 0,
            marginLeft: expandido ? 0 : -8,
            transition: `width ${EXPANDIR_MS}ms ease, margin ${EXPANDIR_MS}ms ease`,
          }}
        >
          <Icon name="arrow" size={18} strokeWidth={2.2} />
        </span>
      </Link>
    </nav>
  )
}
