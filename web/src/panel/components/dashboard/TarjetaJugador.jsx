import { useEffect, useId, useRef } from 'react'
import AvatarTenista from './AvatarTenista.jsx'
import { useContador } from '../../hooks/useContador.js'
import { valoracionJugador } from '../../lib/valoracion.js'
import './tarjetaJugador.css'

const ANCLAS = [
  [0, 70],
  [0, 200],
  [40, 296],
  [115, 330],
  [190, 296],
  [230, 200],
  [230, 70],
  [115, 6],
]

function fractal(inicio, fin, desvio, pasos) {
  let puntos = [inicio, fin]
  let fuerza = desvio
  for (let paso = 0; paso < pasos; paso++) {
    const siguientes = [puntos[0]]
    for (let i = 1; i < puntos.length; i++) {
      const [ax, ay] = puntos[i - 1]
      const [bx, by] = puntos[i]
      const largo = Math.hypot(bx - ax, by - ay) || 1
      const corrimiento = (Math.random() * 2 - 1) * fuerza
      siguientes.push([
        (ax + bx) / 2 - ((by - ay) / largo) * corrimiento,
        (ay + by) / 2 + ((bx - ax) / largo) * corrimiento,
      ])
      siguientes.push(puntos[i])
    }
    puntos = siguientes
    fuerza *= 0.55
  }
  return puntos
}

const trazo = (puntos) =>
  puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')

function relampago(origen, [cx, cy]) {
  const angulo = Math.random() * Math.PI * 2
  const radio = 4 + Math.random() * 10
  const destino = [cx + Math.cos(angulo) * radio, cy + Math.sin(angulo) * radio]
  const largo = Math.hypot(destino[0] - origen[0], destino[1] - origen[1])
  const principal = fractal(origen, destino, largo * 0.16, 6)
  const caminos = [trazo(principal)]
  const ramas = Math.random() > 0.6 ? 1 : 0
  for (let r = 0; r < ramas; r++) {
    const indice = Math.floor(principal.length * (0.2 + Math.random() * 0.5))
    const [bx, by] = principal[indice]
    const [sx, sy] = principal[Math.min(principal.length - 1, indice + 4)]
    const direccion =
      Math.atan2(sy - by, sx - bx) + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.5)
    const alcance = largo * (0.12 + Math.random() * 0.18)
    const final = [bx + Math.cos(direccion) * alcance, by + Math.sin(direccion) * alcance]
    caminos.push(trazo(fractal([bx, by], final, alcance * 0.2, 4)))
  }
  return caminos.join('')
}

function Numero({ valor, prefijo = '' }) {
  const numero = typeof valor === 'number' && Number.isFinite(valor)
  const actual = useContador(numero ? valor : null, { duracion: 800 })
  if (!numero) return '—'
  const decimales = Number.isInteger(valor) ? 0 : 1
  return `${prefijo}${(typeof actual === 'number' ? actual : valor).toFixed(decimales)}`
}

function IconoAtributo({ tipo }) {
  const comun = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }
  if (tipo === 'saque')
    return (
      <svg {...comun}>
        <circle cx="12" cy="12" r="8" />
        <path d="M6.5 6.5c3 2.5 3 8.5 0 11M17.5 6.5c-3 2.5-3 8.5 0 11" />
      </svg>
    )
  if (tipo === 'golpe')
    return (
      <svg {...comun}>
        <ellipse cx="14" cy="9" rx="5.5" ry="6.5" transform="rotate(35 14 9)" />
        <path d="M10.5 13.5L4 20" />
      </svg>
    )
  if (tipo === 'movimiento')
    return (
      <svg {...comun}>
        <path d="M4 17h9l3-3 4 1v3H4z" />
        <path d="M6 13h4M5 10h3" />
      </svg>
    )
  return (
    <svg {...comun}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  )
}

export default function TarjetaJugador({
  player,
  metrics,
  indice = 0,
  ranking = null,
  escala = null,
}) {
  const carta = useRef(null)
  const rayos = useRef([])
  const puntero = useRef({ x: 115, y: 120, activo: false, cuadro: 0, ultimo: 0 })
  const filtro = `electrico-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const nombre =
    typeof player.fullName === 'string' && player.fullName.trim()
      ? player.fullName.trim()
      : 'Sin nombre'
  const { media, atributos } = valoracionJugador(player, metrics)
  const nivel = media == null ? 'bronce' : media >= 80 ? 'oro' : media >= 65 ? 'plata' : 'bronce'

  useEffect(() => {
    const estado = puntero.current
    return () => cancelAnimationFrame(estado.cuadro)
  }, [])

  const dibujar = (tiempo) => {
    const estado = puntero.current
    if (!estado.activo) {
      estado.cuadro = 0
      return
    }
    if (tiempo - estado.ultimo > 65) {
      estado.ultimo = tiempo
      const destino = [estado.x, estado.y]
      const distancias = ANCLAS.map((ancla) => Math.hypot(ancla[0] - estado.x, ancla[1] - estado.y))
      const cercana = Math.min(...distancias)
      rayos.current.forEach((par, i) => {
        if (!par) return
        const visible = distancias[i] < cercana + 70 && Math.random() > 0.5
        const d = relampago(ANCLAS[i], destino)
        par.forEach((camino) => camino?.setAttribute('d', d))
        par[0]?.parentNode?.setAttribute(
          'opacity',
          visible ? (0.4 + Math.random() * 0.45).toFixed(2) : '0',
        )
      })
    }
    estado.cuadro = requestAnimationFrame(dibujar)
  }

  const mover = (evento) => {
    const elemento = carta.current
    if (!elemento || evento.pointerType !== 'mouse') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const rect = elemento.getBoundingClientRect()
    const x = (evento.clientX - rect.left) / rect.width
    const y = (evento.clientY - rect.top) / rect.height
    elemento.style.setProperty('--mx', `${x * 100}%`)
    elemento.style.setProperty('--my', `${y * 100}%`)
    elemento.style.setProperty('--rx', `${(0.5 - y) * 16}deg`)
    elemento.style.setProperty('--ry', `${(x - 0.5) * 20}deg`)
    const estado = puntero.current
    estado.x = x * 230
    estado.y = y * 330
    estado.activo = true
    if (!estado.cuadro) estado.cuadro = requestAnimationFrame(dibujar)
    elemento.dataset.activa = ''
  }
  const soltar = () => {
    const elemento = carta.current
    if (!elemento) return
    delete elemento.dataset.activa
    puntero.current.activo = false
    elemento.style.setProperty('--rx', '0deg')
    elemento.style.setProperty('--ry', '0deg')
  }

  const tarjeta = (
    <div className={`tarjeta-jugador-escena${escala ? ' tarjeta-jugador-escena--compacta' : ''}`}>
      <figure
        ref={carta}
        className={`tarjeta-jugador tarjeta-jugador--${nivel}`}
        onPointerMove={mover}
        onPointerLeave={soltar}
        aria-label={`Tarjeta de ${nombre}${media == null ? '' : `, valoración ${media}`}`}
      >
        <div className="tarjeta-jugador-cuerpo">
          <svg
            className="tarjeta-jugador-marco"
            viewBox="0 0 220 320"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M7 42Q9 37 14 36Q60 30 97 14Q110 8 123 14Q160 30 206 36Q211 37 213 42V250Q213 266 197 278L120 307Q110 312 100 307L23 278Q7 266 7 250Z" />
          </svg>
          <div className="tarjeta-jugador-lateral">
            <p className="tarjeta-jugador-media">
              <Numero valor={media} />
            </p>
            <span className="tarjeta-jugador-escudo" aria-hidden="true">
              AC
            </span>
          </div>
          <AvatarTenista indice={indice} className="tarjeta-jugador-avatar" />
          <div className="tarjeta-jugador-placa">
            <p className="tarjeta-jugador-nombre">{nombre}</p>
          </div>
          <dl className="tarjeta-jugador-atributos">
            {atributos.map(({ clave, nombre: titulo, valor, icono }) => (
              <div key={clave} title={titulo}>
                <IconoAtributo tipo={icono} />
                <dd>
                  <Numero valor={valor} />
                </dd>
                <dt>{clave}</dt>
              </div>
            ))}
          </dl>
          <dl className="tarjeta-jugador-logros">
            <div>
              <dt>Partidos</dt>
              <dd>
                <Numero valor={metrics?.analyzedMatches} />
              </dd>
            </div>
            <div>
              <dt>UTR</dt>
              <dd>
                <Numero valor={player.utr} />
              </dd>
            </div>
            <div>
              <dt>Ranking</dt>
              <dd>
                <Numero valor={ranking} prefijo="#" />
              </dd>
            </div>
          </dl>
          <p className="tarjeta-jugador-pie">
            Valoración <strong>AceCam</strong>
          </p>
          <span className="tarjeta-jugador-brillo" aria-hidden="true" />
          <span className="tarjeta-jugador-holo" aria-hidden="true" />
          <svg
            className="tarjeta-jugador-rayos"
            viewBox="0 0 230 330"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id={filtro} x="-60%" y="-60%" width="220%" height="220%">
                <feTurbulence
                  type="turbulence"
                  baseFrequency="0.045"
                  numOctaves="4"
                  seed="3"
                  result="ruido"
                >
                  <animate
                    attributeName="baseFrequency"
                    values="0.045;0.07;0.04;0.06;0.045"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                </feTurbulence>
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="ruido"
                  scale="7"
                  xChannelSelector="R"
                  yChannelSelector="G"
                >
                  <animate
                    attributeName="scale"
                    values="5;9;4;8;5"
                    dur="0.45s"
                    repeatCount="indefinite"
                  />
                </feDisplacementMap>
              </filter>
            </defs>
            <g filter={`url(#${filtro})`}>
              {ANCLAS.map((ancla, i) => (
                <g key={ancla.join('-')} opacity="0">
                  <path
                    ref={(nodo) => {
                      rayos.current[i] = [nodo, rayos.current[i]?.[1]]
                    }}
                    className="tarjeta-jugador-rayo-halo"
                  />
                  <path
                    ref={(nodo) => {
                      rayos.current[i] = [rayos.current[i]?.[0], nodo]
                    }}
                    className="tarjeta-jugador-rayo-nucleo"
                  />
                </g>
              ))}
            </g>
          </svg>
        </div>
      </figure>
    </div>
  )

  if (!escala) return tarjeta
  return (
    <div className="tarjeta-jugador-reducida" style={{ width: 230 * escala, height: 330 * escala }}>
      <div style={{ width: 230, transform: `scale(${escala})`, transformOrigin: '0 0' }}>
        {tarjeta}
      </div>
    </div>
  )
}
