import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const planes = [
  {
    name: 'Básico',
    price: '[PRECIO]',
    note: 'por mes',
    text: 'Para un entrenador que recién empieza a medir.',
    features: ['Análisis incluidos al mes', 'Dashboard por jugador', 'Reporte en PDF'],
    destacado: false,
  },
  {
    name: 'Pro',
    price: '[PRECIO]',
    note: 'por mes',
    text: 'Para academias con varios alumnos en seguimiento.',
    features: ['Más análisis al mes', 'Comparador de jugadores', 'Bandeja de reclutamiento'],
    destacado: true,
  },
  {
    name: 'Institucional',
    price: 'A medida',
    note: '',
    text: 'Para federaciones y universidades.',
    features: ['Volumen por convenio', 'Varios equipos y roles', 'Soporte dedicado'],
    destacado: false,
  },
]

export default function PlanesPreview() {
  return (
    <Section
      id="planes"
      eyebrow="Planes"
      title="Elige cuánto quieres analizar"
      align="center"
    >
      <div className="mt-12 grid items-start gap-4 lg:grid-cols-3">
        {planes.map((plan, index) => (
          <Reveal key={plan.name} delay={index * 90}>
            <Card
              className={`flex h-full flex-col p-7 ${
                plan.destacado ? 'border-accent-line ring-1 ring-accent-line' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl">{plan.name}</h3>
                {plan.destacado ? (
                  <span className="rounded-full bg-accent px-3 py-1 font-display text-xs font-semibold tracking-wide text-on-accent uppercase">
                    Más popular
                  </span>
                ) : null}
              </div>

              <p className="mt-5 font-display text-4xl leading-none font-bold text-text">
                {plan.price}
                {plan.note ? (
                  <span className="ml-2 font-sans text-sm font-normal text-muted">{plan.note}</span>
                ) : null}
              </p>

              <p className="mt-4 text-sm text-text2">{plan.text}</p>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-text2">
                    <span className="mt-0.5 text-accent-ink">
                      <Icon name="check" size={18} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button to="/precios" variant="secondary" size="lg">
          Ver todos los planes
        </Button>
      </div>
    </Section>
  )
}
