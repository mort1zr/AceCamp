import { useRef } from 'react'
import { Link } from 'react-router'
import Icon from '../../components/Icon.jsx'
import Logo from '../../components/Logo.jsx'
import { useScrollSpring } from '../../hooks/useScrollSpring.js'
import {
  BallTile,
  CourtTile,
  HeatTile,
  LensTile,
  ScoreTile,
  SpeedTile,
} from '../../components/TileArt.jsx'

const anillos = ['size-[36rem]', 'size-[52rem]', 'size-[68rem]']

const flotantes = [
  {
    Contenido: ScoreTile,
    lugar: 'top-10 left-[18%] -rotate-6',
    demora: 0,
    desde: [413, 302],
  },
  {
    Contenido: BallTile,
    lugar: 'top-6 right-[18%] rotate-6',
    demora: 900,
    desde: [-413, 318],
  },
  {
    Contenido: LensTile,
    lugar: 'top-[42%] left-[15%] rotate-3',
    demora: 1800,
    desde: [456, 14],
  },
  {
    Contenido: CourtTile,
    lugar: 'top-[46%] right-[15%] -rotate-3',
    demora: 2700,
    desde: [-456, -17],
  },
  {
    Contenido: HeatTile,
    lugar: 'bottom-8 left-[22%] rotate-6',
    demora: 1300,
    desde: [355, -310],
  },
  {
    Contenido: SpeedTile,
    lugar: 'bottom-4 right-[24%] -rotate-6',
    demora: 2200,
    desde: [-326, -326],
  },
]

const garantias = [
  { icon: 'shield', texto: 'Tu primer mes es', destacado: 'gratis' },
  {
    icon: 'noCamera',
    texto: 'Sin cámaras especiales',
    destacado: 'ni hardware específico',
  },
]

function Invitacion() {
  return (
    <div>
      <h2 className="text-4xl sm:text-5xl">El próximo partido recibe los datos y deja las dudas</h2>
      <p className="mt-4 text-text2">
        Solo sube un video y recibe un reporte de AceCam para tu equipo.
      </p>

      <Link
        to="/registro"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-accent px-8 py-3 text-lg font-semibold text-on-accent transition-opacity hover:opacity-90"
      >
        Empieza ahora
      </Link>

      <ul className="mt-8 space-y-2.5">
        {garantias.map((garantia) => (
          <li
            key={garantia.icon}
            className="flex items-center justify-center gap-2.5 text-base text-muted"
          >
            <Icon name={garantia.icon} size={18} />
            <span>
              {garantia.texto} <span className="text-text">{garantia.destacado}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CierreFinal() {
  const flotantesRef = useRef(null)
  useScrollSpring(flotantesRef, {
    start: 150,
    end: 650,
    property: '--salida',
    relative: true,
  })

  return (
    <section className="relative overflow-hidden px-6 py-28 sm:py-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(var(--line2) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'radial-gradient(ellipse 60% 55% at center, black, transparent 75%)',
        }}
      />
      {anillos.map((tamano) => (
        <span
          key={tamano}
          aria-hidden="true"
          className={`pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-electric/40 ${tamano}`}
        />
      ))}

      <div
        ref={flotantesRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden lg:block"
      >
        {flotantes.map(({ Contenido, lugar, demora, desde: [x, y] }) => (
          <div
            key={lugar}
            className={`absolute will-change-transform ${lugar}`}
            style={{
              translate: `calc((1 - var(--salida, 1)) * ${x}px) calc((1 - var(--salida, 1)) * ${y}px)`,
              scale: 'calc(0.5 + var(--salida, 1) * 0.5)',
            }}
          >
            <div
              style={{ animationDelay: `${demora}ms` }}
              className="grid size-24 place-content-center rounded-3xl border border-line2 bg-surface shadow-tile motion-safe:animate-float [&>*]:scale-[0.85]"
            >
              <Contenido />
            </div>
          </div>
        ))}
      </div>

      <div className="relative mx-auto max-w-xl rounded-[28px] border border-line2 bg-surface px-6 py-12 text-center shadow-tile sm:px-12">
        <Logo size={68} withWordmark={false} className="justify-center" />
        <div className="mt-6">
          <Invitacion />
        </div>
      </div>
    </section>
  )
}
