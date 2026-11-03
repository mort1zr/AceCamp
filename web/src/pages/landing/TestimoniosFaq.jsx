import Accordion from '../../components/Accordion.jsx'
import Card from '../../components/Card.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const preguntas = [
  {
    question: '¿Qué tipo de video sirve?',
    answer:
      'Un video del partido grabado desde el fondo de la pista, con la cancha completa en cuadro. Sirve un celular en un trípode, y acepta archivos subidos o un link de YouTube.',
  },
  {
    question: '¿Cuánto tarda el análisis?',
    answer:
      'Depende de la duración y la resolución del video. Verás el avance en la cola de procesamiento y recibirás un aviso cuando el reporte esté listo.',
  },
  {
    question: '¿Qué tan precisas son las velocidades?',
    answer:
      'Son estimaciones calculadas a partir del video, no mediciones de radar. Sirven para comparar saques entre sí y seguir la evolución de un jugador, no como dato oficial.',
  },
  {
    question: '¿Cómo se protegen los datos de los menores (Ley 29733)?',
    answer:
      'Los videos y los reportes solo son visibles para la organización que los sube. Para jugadores menores de edad se requiere el consentimiento del padre, madre o tutor, y puedes pedir la eliminación de los datos en cualquier momento.',
  },
  {
    question: '¿Puedo cancelar cuando quiera?',
    answer:
      'Sí. El plan se cancela desde Configuración y sigue activo hasta el final del periodo ya pagado, sin penalidad.',
  },
]

export default function TestimoniosFaq() {
  return (
    <Section id="preguntas" title="Lo que dicen y lo que preguntan">
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Reveal key={index} delay={index * 90}>
            <Card className="flex h-full min-h-44 flex-col justify-end gap-3 border-dashed p-6">
              <p className="text-sm text-placeholder">[Testimonio real del piloto]</p>
              <div className="h-px bg-line" />
              <p className="font-display text-sm tracking-wide text-placeholder uppercase">
                Nombre · Club
              </p>
            </Card>
          </Reveal>
        ))}
      </div>

      <h3 className="mt-16 text-2xl sm:text-3xl">Preguntas frecuentes</h3>
      <Reveal className="mt-6">
        <Accordion items={preguntas} />
      </Reveal>
    </Section>
  )
}
