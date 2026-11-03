import Icon from '../../components/Icon.jsx'
import Reveal from '../../components/Reveal.jsx'
import Section from '../../components/Section.jsx'

const columnas = ['AceCam', 'Análisis manual', 'Apps solo para iPhone']

const filas = [
  { label: 'Funciona en la web desde cualquier dispositivo', valores: [true, true, false] },
  { label: 'En español', valores: [true, true, false] },
  { label: 'Precios en soles', valores: [true, true, false] },
  { label: 'Analiza videos que ya existen', valores: [true, true, false] },
  { label: 'Estadísticas automáticas', valores: [true, false, true] },
]

function Marca({ activo }) {
  return (
    <span className={activo ? 'text-good' : 'text-bad'}>
      <Icon name={activo ? 'check' : 'close'} size={20} />
      <span className="sr-only">{activo ? 'Sí' : 'No'}</span>
    </span>
  )
}

export default function Comparacion() {
  return (
    <Section eyebrow="Comparación" title="Por qué no basta con lo que ya existe">
      <Reveal className="mt-10 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Comparación de AceCam frente al análisis manual y a las apps solo para iPhone
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
                  className={`px-5 py-4 text-center font-display text-sm tracking-wide ${
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
