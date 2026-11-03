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
    tone: 'text-series2',
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

const heatCells = [
  0.1, 0.2, 0.35, 0.5, 0.3, 0.15, 0.25, 0.45, 0.8, 1, 0.6, 0.3, 0.2, 0.5, 0.9, 0.75, 0.4, 0.2, 0.1,
  0.15, 0.3, 0.35, 0.2, 0.1,
]

export default function QueMide() {
  return (
    <Section
      id="que-mide"
      title="Las métricas que un entrenador pide después de cada partido"
      lead="Todo sale del video, sin sensores ni relojes."
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
            <div
              className="mt-4 grid grid-cols-6 gap-1 overflow-hidden rounded-lg border border-line"
              aria-hidden="true"
            >
              {heatCells.map((intensity, index) => (
                <span
                  key={index}
                  className="aspect-square bg-accent"
                  style={{ opacity: 0.12 + intensity * 0.7 }}
                />
              ))}
            </div>
          </Card>
        </Reveal>
      </div>
    </Section>
  )
}
