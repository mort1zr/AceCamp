import AppFrame from '../../components/AppFrame.jsx'
import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const modulos = [
  {
    title: 'Dashboard del jugador',
    text: 'Un panel por jugador con sus KPIs y la evolución partido a partido. Filtra por rango de fechas, superficie o rival.',
    bullets: ['Tendencia de cada métrica', 'Comparación con su propio promedio', 'Alertas de bajones'],
    frame: 'Dashboard del jugador',
  },
  {
    title: 'Comparador',
    text: 'Pon de 2 a 4 jugadores lado a lado y mira la misma métrica en columnas. Útil para decidir a quién reclutar.',
    bullets: ['De 2 a 4 columnas', 'Misma escala para todos', 'Exportable a PDF'],
    frame: 'Comparador de jugadores',
  },
  {
    title: 'Reporte por partido',
    text: 'El video con las estadísticas encima y los clips de los puntos que importan, listos para revisar con el alumno.',
    bullets: ['Marcador sobre el video', 'Clips por punto', 'Resumen descargable'],
    frame: 'Reporte del partido',
  },
  {
    title: 'Reclutamiento',
    text: 'Un formulario público de postulación y una bandeja ordenada con los candidatos y sus números.',
    bullets: ['Formulario que puedes compartir', 'Bandeja con estados', 'Crear jugador desde la postulación'],
    frame: 'Bandeja de reclutamiento',
  },
]

export default function Modulos() {
  return (
    <Section
      id="funciones"
      title="Cuatro módulos que cubren el ciclo completo"
    >
      <div className="mt-12 space-y-16 sm:space-y-24">
        {modulos.map((modulo, index) => (
          <div
            key={modulo.title}
            className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
          >
            <Reveal className={index % 2 === 1 ? 'lg:order-2' : ''}>
              <h3 className="text-2xl sm:text-3xl">{modulo.title}</h3>
              <p className="mt-4 text-text2">{modulo.text}</p>
              <ul className="mt-5 space-y-2">
                {modulo.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm text-text2">
                    <span className="mt-0.5 text-accent-ink">
                      <Icon name="check" size={18} />
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={100} className={index % 2 === 1 ? 'lg:order-1' : ''}>
              <AppFrame label={modulo.frame} />
            </Reveal>
          </div>
        ))}
      </div>
    </Section>
  )
}
