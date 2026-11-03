import Card from '../../components/Card.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const metricas = [
  {
    icon: 'serve',
    label: 'Saque más rápido',
    value: '184',
    unit: 'km/h',
    tone: 'text-series1',
    detail: 'Velocidad estimada del saque más fuerte del partido.',
  },
  {
    icon: 'percent',
    label: 'Primeros saques',
    value: '68',
    unit: '%',
    tone: 'text-electric-ink',
    detail: 'Cuántos primeros saques entraron.',
  },
  {
    icon: 'fault',
    label: 'Dobles faltas',
    value: '4',
    unit: '',
    tone: 'text-bad',
    detail: 'Puntos regalados en el servicio.',
  },
  {
    icon: 'racket',
    label: 'Derecha vs. revés',
    value: '62/38',
    unit: '',
    tone: 'text-series3',
    detail: 'Reparto de golpes por lado.',
  },
  {
    icon: 'rally',
    label: 'Peloteos',
    value: '9.4',
    unit: 'golpes',
    tone: 'text-series4',
    detail: 'Promedio de golpes por punto.',
  },
  {
    icon: 'distance',
    label: 'Distancia recorrida',
    value: '3.2',
    unit: 'km',
    tone: 'text-good',
    detail: 'Cuánto corrió el jugador en la pista.',
  },
]

const LARGO = 237.7
const ANCHO = 109.7
const COLUMNAS = 14
const FILAS = 7
const SEPARACION = 1.6
const CELDA = LARGO / COLUMNAS
const AFUERA = CELDA

const focos = [
  { x: -0.01, y: 0.5, fuerza: 1, alcance: 0.11 },
  { x: 0.03, y: 0.22, fuerza: 0.55, alcance: 0.09 },
  { x: 0.03, y: 0.8, fuerza: 0.5, alcance: 0.09 },
  { x: 0.3, y: 0.45, fuerza: 0.35, alcance: 0.08 },
]

const celdas = Array.from({ length: (COLUMNAS + 2) * FILAS }, (_, indice) => {
  const columna = (indice % (COLUMNAS + 2)) - 1
  const fila = Math.floor(indice / (COLUMNAS + 2))
  const cx = (columna + 0.5) / COLUMNAS
  const cy = (fila + 0.5) / FILAS
  const calor = focos.reduce(
    (total, foco) =>
      total +
      foco.fuerza *
        Math.exp(-(((cx - foco.x) * 2.17) ** 2 + (cy - foco.y) ** 2) / (2 * foco.alcance ** 2 * 4)),
    0,
  )
  return {
    x: columna * CELDA + SEPARACION / 2,
    y: (fila * ANCHO) / FILAS + SEPARACION / 2,
    ancho: CELDA - SEPARACION,
    alto: ANCHO / FILAS - SEPARACION,
    opacidad: 0.06 + Math.min(calor, 1) * 0.8,
  }
})

function CanchaDeCalor() {
  const red = LARGO / 2
  return (
    <svg
      viewBox={`${-AFUERA - 4} -4 ${LARGO + AFUERA * 2 + 8} ${ANCHO + 8}`}
      className="mt-5 w-full"
      aria-hidden="true"
    >
      <rect
        x={-AFUERA - 4}
        y="-4"
        width={LARGO + AFUERA * 2 + 8}
        height={ANCHO + 8}
        rx="6"
        fill="var(--surface2)"
      />
      {celdas.map((celda, indice) => (
        <rect
          key={indice}
          x={celda.x}
          y={celda.y}
          width={celda.ancho}
          height={celda.alto}
          rx="1.2"
          fill="var(--accent)"
          opacity={celda.opacidad}
        />
      ))}
      <g fill="none" stroke="var(--electric)" strokeWidth="0.9" opacity="0.85">
        <rect x="0" y="0" width={LARGO} height={ANCHO} />
        <path d={`M0 13.7H${LARGO}M0 96H${LARGO}`} />
        <path d={`M54.85 13.7V96M182.85 13.7V96M54.85 54.85H182.85`} />
        <path d={`M0 54.85h3M${LARGO} 54.85h-3`} />
      </g>
      <path
        d={`M${red} -3V${ANCHO + 3}`}
        stroke="var(--text)"
        strokeWidth="1.4"
        strokeDasharray="2 1.5"
        opacity="0.7"
      />
    </svg>
  )
}

export default function QueMide() {
  return (
    <Section
      id="que-mide"
      title={
        <>
          Lo que tu vista no alcanza, <span className="text-accent-ink">AceCam</span> lo hace
          por ti
        </>
      }
      lead="Cada saque, cada golpe y cada metro recorrido, sacados del video."
    >
      <p className="mt-8 font-display text-xs tracking-[0.2em] text-muted uppercase">
        Ejemplo de un partido
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metricas.map((metrica, index) => (
          <Reveal key={metrica.label} delay={index * 60}>
            <Card className="flex h-full flex-col p-5">
              <span className="text-muted">
                <Icon name={metrica.icon} />
              </span>
              <p className="mt-4 text-xs font-medium tracking-wide text-muted uppercase">
                {metrica.label}
              </p>
              <p className={`mt-1 font-display text-4xl leading-none font-bold ${metrica.tone}`}>
                {metrica.value}
                {metrica.unit ? (
                  <span className="ml-1 text-lg font-semibold text-muted">{metrica.unit}</span>
                ) : null}
              </p>
              <p className="mt-3 text-sm text-text2">{metrica.detail}</p>
            </Card>
          </Reveal>
        ))}

        <Reveal delay={360} className="col-span-2">
          <Card className="flex h-full flex-col p-5">
            <span className="text-muted">
              <Icon name="heatmap" />
            </span>
            <p className="mt-4 text-xs font-medium tracking-wide text-muted uppercase">
              Mapa de calor
            </p>
            <p className="mt-3 text-sm text-text2">
              Dónde se paró el jugador durante todo el partido.
            </p>
            <CanchaDeCalor />
          </Card>
        </Reveal>
      </div>
    </Section>
  )
}
