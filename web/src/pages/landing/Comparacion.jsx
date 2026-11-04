import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'
import { useTextos } from '../../lib/idioma.jsx'

const valores = [
  [true, true, false],
  [true, true, false],
  [true, true, false],
  [true, false, false],
  [true, true, false],
  [true, false, true],
  [true, false, false],
]

const textos = {
  es: {
    titulo: 'Por qué no basta con lo que existe',
    columnas: ['AceCam', 'Análisis manual', 'Apps de celular'],
    filas: [
      'Sin smartwatch ni hardware especial',
      'Graba con cualquier cámara, no solo desde la app',
      'Analiza videos propios o de YouTube',
      'Analiza a los dos jugadores en un solo análisis',
      'Funciona desde cualquier dispositivo',
      'Estadísticas automáticas, sin tomar apuntes',
      'Dashboard con métricas de todos tus jugadores y partidos',
    ],
    resumen: 'Comparación de AceCam frente al análisis manual y a las apps de celular',
    caracteristica: 'Característica',
    si: 'Sí',
    no: 'No',
  },
  en: {
    titulo: 'Why what exists isn’t enough',
    columnas: ['AceCam', 'Manual analysis', 'Phone apps'],
    filas: [
      'No smartwatch or special hardware',
      'Record with any camera, not just from the app',
      'Analyze your own videos or YouTube',
      'Analyze both players in a single analysis',
      'Works from any device',
      'Automatic stats, no note-taking',
      'Dashboard with metrics for all your players and matches',
    ],
    resumen: 'Comparison of AceCam with manual analysis and phone apps',
    caracteristica: 'Feature',
    si: 'Yes',
    no: 'No',
  },
}

function Marca({ activo, t }) {
  if (typeof activo === 'string') {
    return <span className="text-xs text-muted">{activo}</span>
  }

  return (
    <span className={activo ? 'text-good' : 'text-bad'}>
      <Icon name={activo ? 'check' : 'close'} size={20} />
      <span className="sr-only">{activo ? t.si : t.no}</span>
    </span>
  )
}

export default function Comparacion() {
  const t = useTextos(textos)
  const columnas = t.columnas

  return (
    <Section title={t.titulo}>
      <Reveal className="mt-10 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">{t.resumen}</caption>
          <thead>
            <tr className="bg-surface2">
              <th scope="col" className="px-5 py-4 text-sm font-semibold text-text">
                <span className="sr-only">{t.caracteristica}</span>
              </th>
              {columnas.map((columna, index) => (
                <th
                  key={columna}
                  scope="col"
                  className={`px-5 py-4 text-center font-display text-lg font-semibold tracking-wide ${
                    index === 0 ? 'text-accent-ink' : 'text-muted'
                  }`}
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.filas.map((fila, indiceFila) => (
              <tr key={fila} className="border-t border-line">
                <th scope="row" className="px-5 py-4 text-sm font-medium text-text2">
                  {fila}
                </th>
                {valores[indiceFila].map((valor, index) => (
                  <td key={columnas[index]} className="px-5 py-4 text-center">
                    <span className="inline-flex justify-center">
                      <Marca activo={valor} t={t} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </Section>
  )
}
