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
    <Section id="como-funciona" title="Los datos del partido se quedan en el video">
      <ul className="mt-8 max-w-3xl space-y-3">
        {problemas.map((problema, index) => (
          <Reveal as="li" key={problema} delay={index * 90}>
            <p className="font-display text-2xl leading-snug font-semibold text-text2 sm:text-3xl">
              {problema}
            </p>
          </Reveal>
        ))}
      </ul>

      <h3 className="mt-20 text-3xl sm:text-4xl">Por eso, solo tres pasos</h3>

      <ol className="relative mt-10 grid gap-8 sm:grid-cols-3">
        <span className="absolute top-6 right-1/6 left-1/6 hidden h-px bg-line2 sm:block" />
        {pasos.map((paso, index) => (
          <Reveal
            as="li"
            key={paso.title}
            delay={index * 90}
            className="relative flex items-start gap-4 sm:flex-col sm:items-center sm:text-center"
          >
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-electric bg-bg text-electric-ink">
              <Icon name={paso.icon} />
            </span>
            <div>
              <p className="font-display text-xl font-semibold">{paso.title}</p>
              <p className="mt-1 text-sm text-text2">{paso.text}</p>
            </div>
          </Reveal>
        ))}
      </ol>

      <p className="mt-10 text-center text-text2">Sin cámaras especiales ni hardware.</p>
    </Section>
  )
}
