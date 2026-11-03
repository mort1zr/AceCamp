import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const columnas = ['AceCam', 'Análisis manual', 'Apps de celular']

const filas = [
  { label: 'Sin smartwatch ni hardware especial', valores: [true, true, false] },
  { label: 'Graba con cualquier cámara, no solo desde la app', valores: [true, true, false] },
  { label: 'Analiza videos propios o de YouTube', valores: [true, true, false] },
  { label: 'Analiza a los dos jugadores en un solo análisis', valores: [true, false, false] },
  { label: 'Funciona desde cualquier dispositivo', valores: [true, true, false] },
  { label: 'Estadísticas automáticas, sin tomar apuntes', valores: [true, false, true] },
  {
    label: 'Dashboard con métricas de todos tus jugadores y partidos',
    valores: [true, false, false],
  },
]

function Marca({ activo }) {
  if (typeof activo === 'string') {
    return <span className="text-xs text-muted">{activo}</span>
  }

  return (
    <span className={activo ? 'text-good' : 'text-bad'}>
      <Icon name={activo ? 'check' : 'close'} size={20} />
      <span className="sr-only">{activo ? 'Sí' : 'No'}</span>
    </span>
  )
}

export default function Comparacion() {
  return (
    <Section title="Por qué no basta con lo que existe">
      <Reveal className="mt-10 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Comparación de AceCam frente al análisis manual y a las apps de celular
          </caption>
          <thead>
            <tr className="bg-surface2">
              <th scope="col" className="px-5 py-4 text-sm font-semibold text-text">
                <span className="sr-only">Característica</span>
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
            {filas.map((fila) => (
              <tr key={fila.label} className="border-t border-line">
                <th scope="row" className="px-5 py-4 text-sm font-medium text-text2">
                  {fila.label}
                </th>
                {fila.valores.map((valor, index) => (
                  <td key={columnas[index]} className="px-5 py-4 text-center">
                    <span className="inline-flex justify-center">
                      <Marca activo={valor} />
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
