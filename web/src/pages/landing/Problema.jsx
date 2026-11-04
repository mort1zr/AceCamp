import Card from '../../components/Card.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const problemas = [
  'Revisar un partido a mano toma horas.',
  'Los videos de postulación no dicen cuánto saca ni cuánto corre un jugador.',
  'Comparar candidatos termina siendo intuición.',
]

const pasos = [
  { icon: 'upload', title: 'Sube el video', text: 'Un archivo o un link de YouTube.' },
  { icon: 'ai', title: 'La IA analiza el partido', text: 'Detecta saques, golpes y botes.' },
  { icon: 'report', title: 'Recibes el reporte', text: 'Estadísticas, clips y PDF.' },
]

export default function Problema() {
  return (
    <Section
      id="como-funciona"
      eyebrow="El problema"
      title="Los datos del partido se quedan en el video"
    >
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {problemas.map((problema, index) => (
          <Reveal key={problema} delay={index * 90}>
            <Card className="h-full p-6">
              <p className="font-display text-5xl leading-none font-bold text-line3">
                {String(index + 1).padStart(2, '0')}
              </p>
              <p className="mt-4 text-text2">{problema}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      <h3 className="mt-16 text-2xl sm:text-3xl">Cómo funciona</h3>

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {pasos.map((paso, index) => (
          <Reveal as="li" key={paso.title} delay={index * 90}>
            <Card className="flex h-full flex-col gap-3 p-6">
              <span className="inline-flex size-11 items-center justify-center rounded-full bg-chip text-accent-ink">
                <Icon name={paso.icon} />
              </span>
              <p className="font-display text-xl font-semibold">{paso.title}</p>
              <p className="text-sm text-text2">{paso.text}</p>
            </Card>
          </Reveal>
        ))}
      </ol>

      <p className="mt-8 text-center font-display text-lg tracking-wide text-muted">
        Sin cámaras especiales ni hardware.
      </p>
    </Section>
  )
}
