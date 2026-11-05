import Icon from '../components/Icon.jsx'
import Reveal from '../components/Reveal.jsx'
import Section from '../components/Section.jsx'
import { useTextos } from '../../compartido/lib/idioma.jsx'

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
    cortas: ['AceCam', 'Manual', 'Apps'],
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
    cortas: ['AceCam', 'Manual', 'Apps'],
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
  return (
    <span className={activo ? 'text-good' : 'text-bad opacity-80'}>
      <Icon name={activo ? 'check' : 'close'} size={20} className="max-sm:size-[18px]" />
      <span className="sr-only">{activo ? t.si : t.no}</span>
    </span>
  )
}

export default function Comparacion() {
  const t = useTextos(textos)
  const columnas = t.columnas

  return (
    <Section title={t.titulo}>
      <Reveal className="mt-8 overflow-hidden rounded-card border border-line sm:mt-10 sm:overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left sm:min-w-[34rem] sm:table-auto">
          <caption className="sr-only">{t.resumen}</caption>
          <thead>
            <tr className="bg-surface2">
              <th
                scope="col"
                className="px-3.5 py-3 text-sm font-semibold text-text sm:px-5 sm:py-4"
              >
                <span className="sr-only">{t.caracteristica}</span>
              </th>
              {columnas.map((columna, index) => (
                <th
                  key={columna}
                  scope="col"
                  className={`w-[3.4rem] px-0.5 py-3 text-center font-display text-[12px] leading-tight font-semibold tracking-wide sm:w-auto sm:px-5 sm:py-4 sm:text-lg ${
                    index === 0 ? 'text-accent-ink max-sm:bg-accent/10' : 'text-muted'
                  }`}
                >
                  <span className="sm:hidden">{t.cortas[index]}</span>
                  <span className="max-sm:hidden">{columna}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.filas.map((fila, indiceFila) => (
              <tr key={fila} className="border-t border-line">
                <th
                  scope="row"
                  className="px-3.5 py-3 text-[13px] leading-snug font-medium text-text2 sm:px-5 sm:py-4 sm:text-sm"
                >
                  {fila}
                </th>
                {valores[indiceFila].map((valor, index) => (
                  <td
                    key={columnas[index]}
                    className={`px-1 py-3 text-center sm:px-5 sm:py-4 ${index === 0 ? 'max-sm:bg-accent/5' : ''}`}
                  >
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
