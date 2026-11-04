import { useTextos } from '../../lib/idioma.jsx'

const atributos = [
  { valor: 100, promedio: 58 },
  { valor: 84, promedio: 60 },
  { valor: 78, promedio: 50 },
  { valor: 72, promedio: 46 },
  { valor: 100, promedio: 40 },
  { valor: 81, promedio: 56 },
]

const metricas = [
  { valor: '68%', barra: 68 },
  { valor: '4%', barra: 4 },
  { valor: '9.4', barra: 47 },
  { valor: '80%', barra: 80 },
]

const forma = [true, true, false, true, true]

const textos = {
  es: {
    siglas: ['SAQ', 'DER', 'REV', 'VOL', 'MOV', 'RES'],
    metricas: ['Primeros saques', 'Dobles faltas', 'Promedio de peloteo', 'Partidos ganados'],
    golpes: 'golpes',
    pestanas: ['Resumen', 'Saque', 'Golpes', 'Movimiento'],
    global: 'GLOBAL',
    estilo: 'Diestro · Revés a dos manos',
    perfil: 'Perfil de juego',
    jugador: 'Jugador',
    promedio: 'Promedio',
    rendimiento: 'Rendimiento',
    ultimos: 'Últimos 5 partidos',
    victoria: 'V',
    derrota: 'D',
    ejemplo: 'Datos de ejemplo',
    descripcion:
      'Ejemplo del dashboard de un jugador en AceCam, con su valoración global, seis atributos y métricas de rendimiento',
  },
  en: {
    siglas: ['SRV', 'FH', 'BH', 'VOL', 'MOV', 'END'],
    metricas: ['First serves', 'Double faults', 'Average rally', 'Matches won'],
    golpes: 'shots',
    pestanas: ['Overview', 'Serve', 'Shots', 'Movement'],
    global: 'OVERALL',
    estilo: 'Right-handed · Two-handed backhand',
    perfil: 'Game profile',
    jugador: 'Player',
    promedio: 'Average',
    rendimiento: 'Performance',
    ultimos: 'Last 5 matches',
    victoria: 'W',
    derrota: 'L',
    ejemplo: 'Sample data',
    descripcion:
      'Sample AceCam player dashboard, with an overall rating, six attributes and performance metrics',
  },
}

const CENTRO = 130
const RADIO = 92

function punto(indice, escala) {
  const angulo = (Math.PI / 3) * indice - Math.PI / 2
  return [CENTRO + Math.cos(angulo) * RADIO * escala, CENTRO + Math.sin(angulo) * RADIO * escala]
}

function hexagono(escalas) {
  return escalas.map((escala, indice) => punto(indice, escala).join(',')).join(' ')
}

function TarjetaJugador() {
  const t = useTextos(textos)

  return (
    <article className="flex flex-col rounded-[18px] bg-accent p-5 text-on-accent">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-7xl leading-none font-bold">87</p>
          <p className="mt-1 font-display text-sm font-semibold tracking-widest">{t.global}</p>
        </div>
        <svg width="44" height="44" viewBox="0 0 30 30" fill="none" aria-hidden="true">
          <circle cx="15" cy="15" r="13" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M6 6c5 4.5 5 13.5 0 18M24 6c-5 4.5-5 13.5 0 18"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      </div>

      <p className="mt-5 font-display text-2xl font-bold">Rolando Roller</p>
      <p className="text-sm">{t.estilo}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5 border-t border-on-accent/25 pt-4">
        {atributos.map((atributo, indice) => (
          <div key={indice} className="flex items-baseline gap-2">
            <dd className="font-display text-2xl leading-none font-bold">{atributo.valor}</dd>
            <dt className="font-display text-sm font-semibold tracking-wide">{t.siglas[indice]}</dt>
          </div>
        ))}
      </dl>
    </article>
  )
}

function Radar() {
  const t = useTextos(textos)
  const jugador = atributos.map((atributo) => atributo.valor / 100)
  const promedio = atributos.map((atributo) => atributo.promedio / 100)

  return (
    <div className="rounded-[18px] border border-line bg-surface2 p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <p className="font-medium text-text">{t.perfil}</p>
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-electric" />
            {t.jugador}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-series1" />
            {t.promedio}
          </span>
        </p>
      </div>

      <svg viewBox="0 0 260 260" fill="none" className="mx-auto mt-1 w-full max-w-64">
        {[0.25, 0.5, 0.75, 1].map((escala) => (
          <polygon
            key={escala}
            points={hexagono(atributos.map(() => escala))}
            stroke="var(--line2)"
          />
        ))}
        <polygon
          points={hexagono(promedio)}
          fill="var(--series1)"
          fillOpacity="0.95"
          stroke="var(--series1)"
          strokeWidth="2"
        />
        <polygon
          points={hexagono(jugador)}
          fill="var(--electric)"
          fillOpacity="0.12"
          stroke="var(--electric)"
          strokeWidth="2"
        />
        {atributos.map((atributo, indice) => {
          const [x, y] = punto(indice, jugador[indice])
          const [labelX, labelY] = punto(indice, 1.2)
          return (
            <g key={indice}>
              <circle cx={x} cy={y} r="3.5" fill="var(--electric)" />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text2)"
                className="font-display text-sm font-semibold"
              >
                {t.siglas[indice]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Rendimiento() {
  const t = useTextos(textos)

  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface2 p-4">
      <p className="text-xs font-medium text-text">{t.rendimiento}</p>

      <ul className="space-y-3">
        {metricas.map((metrica, indice) => (
          <li key={indice}>
            <div className="flex items-baseline justify-between gap-3 text-xs text-text2">
              <span>{t.metricas[indice]}</span>
              <span className="font-display text-base font-bold text-text tabular-nums">
                {indice === 2 ? `${metrica.valor} ${t.golpes}` : metrica.valor}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-electric"
                style={{ width: `${metrica.barra}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-muted">{t.ultimos}</p>
        <ul className="flex gap-1">
          {forma.map((resultado, indice) => (
            <li
              key={indice}
              className={`grid size-6 place-content-center rounded-md font-display text-xs font-bold ${
                resultado ? 'bg-good text-on-accent' : 'bg-bad text-on-accent'
              }`}
            >
              {resultado ? t.victoria : t.derrota}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function HeroMock() {
  const t = useTextos(textos)

  return (
    <div
      role="img"
      aria-label={t.descripcion}
      className="overflow-hidden rounded-t-[28px] border border-b-0 border-line2 bg-surface2 p-2 pb-0"
    >
      <p className="px-3 pb-2 text-right text-xs text-muted">{t.ejemplo}</p>

      <div className="rounded-t-[22px] border border-b-0 border-line bg-surface p-3 pb-24 sm:p-4 sm:pb-24">
        <div className="mb-3 flex flex-wrap items-center gap-1 sm:mb-4">
          {t.pestanas.map((pestana, indice) => (
            <span
              key={pestana}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                indice === 0 ? 'bg-chip text-text' : 'text-muted'
              }`}
            >
              {pestana}
            </span>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[17rem_1fr_1fr]">
          <TarjetaJugador />
          <Radar />
          <Rendimiento />
        </div>
      </div>
    </div>
  )
}
