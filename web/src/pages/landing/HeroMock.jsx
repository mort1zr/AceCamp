const atributos = [
  { sigla: 'SAQ', nombre: 'Saque', valor: 89, promedio: 58 },
  { sigla: 'DER', nombre: 'Derecha', valor: 84, promedio: 60 },
  { sigla: 'REV', nombre: 'Revés', valor: 78, promedio: 54 },
  { sigla: 'VOL', nombre: 'Volea', valor: 72, promedio: 46 },
  { sigla: 'MOV', nombre: 'Movimiento', valor: 86, promedio: 62 },
  { sigla: 'RES', nombre: 'Resistencia', valor: 81, promedio: 56 },
]

const metricas = [
  { nombre: 'Primeros saques', valor: 68 },
  { nombre: 'Puntos ganados con saque', valor: 74 },
  { nombre: 'Peloteos ganados', valor: 58 },
  { nombre: 'Efectividad en la red', valor: 61 },
]

const forma = ['V', 'V', 'D', 'V', 'V']

const pestanas = ['Resumen', 'Saque', 'Golpes', 'Movimiento']

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
  return (
    <article className="flex flex-col rounded-[18px] bg-accent p-5 text-on-accent">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-7xl leading-none font-bold">87</p>
          <p className="mt-1 font-display text-sm font-semibold tracking-widest">GLOBAL</p>
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

      <p className="mt-5 font-display text-2xl font-bold">Jugador de ejemplo</p>
      <p className="text-sm">Diestro · Revés a dos manos</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1.5 border-t border-on-accent/25 pt-4">
        {atributos.map((atributo) => (
          <div key={atributo.sigla} className="flex items-baseline gap-2">
            <dd className="font-display text-2xl leading-none font-bold">{atributo.valor}</dd>
            <dt className="font-display text-sm font-semibold tracking-wide">{atributo.sigla}</dt>
          </div>
        ))}
      </dl>
    </article>
  )
}

function Radar() {
  const jugador = atributos.map((atributo) => atributo.valor / 100)
  const promedio = atributos.map((atributo) => atributo.promedio / 100)

  return (
    <div className="rounded-[18px] border border-line bg-surface2 p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted">
        <p className="font-medium text-text">Perfil de juego</p>
        <p className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-electric" />
            Jugador
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-series1" />
            Promedio
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
            <g key={atributo.sigla}>
              <circle cx={x} cy={y} r="3.5" fill="var(--electric)" />
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text2)"
                className="font-display text-sm font-semibold"
              >
                {atributo.sigla}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Rendimiento() {
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface2 p-4">
      <p className="text-xs font-medium text-text">Rendimiento</p>

      <ul className="space-y-3">
        {metricas.map((metrica) => (
          <li key={metrica.nombre}>
            <div className="flex items-baseline justify-between gap-3 text-xs text-text2">
              <span>{metrica.nombre}</span>
              <span className="font-display text-base font-bold text-text tabular-nums">
                {metrica.valor}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chip">
              <div className="h-full rounded-full bg-electric" style={{ width: `${metrica.valor}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-xs text-muted">Últimos 5 partidos</p>
        <ul className="flex gap-1">
          {forma.map((resultado, indice) => (
            <li
              key={indice}
              className={`grid size-6 place-content-center rounded-md font-display text-xs font-bold ${
                resultado === 'V' ? 'bg-good text-on-accent' : 'bg-bad text-on-accent'
              }`}
            >
              {resultado}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function HeroMock() {
  return (
    <div
      role="img"
      aria-label="Ejemplo del dashboard de un jugador en AceCam, con su valoración global, seis atributos y métricas de rendimiento"
      className="overflow-hidden rounded-t-[28px] border border-b-0 border-line2 bg-surface2 p-2 pb-0"
    >
      <p className="px-3 pb-2 text-right text-xs text-muted">Datos de ejemplo</p>

      <div className="rounded-t-[22px] border border-b-0 border-line bg-surface p-3 pb-24 sm:p-4 sm:pb-24">
        <div className="mb-3 flex flex-wrap items-center gap-1 sm:mb-4">
          {pestanas.map((pestana, indice) => (
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
