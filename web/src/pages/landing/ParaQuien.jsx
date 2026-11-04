import Card from '../../components/Card.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const perfiles = [
  {
    icon: 'coach',
    title: 'Entrenadores y academias',
    text: 'Siguen el progreso de cada alumno con números, no con impresiones.',
  },
  {
    icon: 'scout',
    title: 'Reclutadores universitarios',
    text: 'Comparan candidatos con datos y reciben las postulaciones ordenadas.',
  },
  {
    icon: 'family',
    title: 'Jugadores y padres',
    text: 'Obtienen un reporte listo para enviar a universidades.',
  },
]

export default function ParaQuien() {
  return (
    <Section eyebrow="Para quién es" title="Tres formas de usar AceCam" align="center">
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {perfiles.map((perfil, index) => (
          <Reveal key={perfil.title} delay={index * 90}>
            <Card className="flex h-full flex-col items-center gap-4 p-7 text-center">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-chip text-accent-ink">
                <Icon name={perfil.icon} size={24} />
              </span>
              <h3 className="text-xl">{perfil.title}</h3>
              <p className="text-sm text-text2">{perfil.text}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
