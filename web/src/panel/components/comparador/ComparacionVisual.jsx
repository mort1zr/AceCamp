import { useId } from 'react'
import { useUnidades } from '../../hooks/useUnidades.js'
import { useValoresAnimados } from '../../hooks/useValoresAnimados.js'
import { filasDeComparacion } from '../../lib/comparacionFilas.js'
import { valoracionJugador } from '../../lib/valoracion.js'
import './comparacion.css'

const numero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
export const COLORES = ['var(--series1)', 'var(--series2)', 'var(--series3)', 'var(--series4)']

const CENTRO = 120
const RADIO = 76

function punto(indice, total, radio) {
  const angulo = -Math.PI / 2 + (indice * 2 * Math.PI) / total
  return [CENTRO + Math.cos(angulo) * radio, CENTRO + Math.sin(angulo) * radio]
}
const poligono = (puntos) => puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function ejesDe(jugador, datos) {
  const { atributos, nivel } = valoracionJugador(jugador ?? null, datos?.metrics)
  return [...atributos, { clave: 'NIV', nombre: 'Nivel UTR', valor: nivel }]
}

export function RadarSuperpuesto({ columnas }) {
  const ejes = columnas.map((columna) => ejesDe(columna.jugador, columna.resumen.data))
  const referencia = ejes[0]
  const total = referencia.length
  const valores = useValoresAnimados(ejes.flatMap((lista) => lista.map((eje) => eje.valor)))
  const medidos = ejes.flatMap((lista) => lista.map((eje) => eje.valor)).filter((valor) => valor != null)
  const bajo = medidos.length ? Math.max(0, Math.floor((Math.min(...medidos) - 25) / 10) * 10) : 0
  const alto = medidos.length ? Math.min(100, Math.max(bajo + 30, Math.ceil((Math.max(...medidos) + 2) / 5) * 5)) : 100
  const fraccion = (valor) => Math.max(0.04, (valor - bajo) / (alto - bajo))
  const descripcion = columnas
    .map((columna, i) => `${columna.titulo}: ${ejes[i].map((eje) => `${eje.nombre} ${eje.valor ?? 'sin datos'}`).join(', ')}`)
    .join('. ')
  return (
    <section className="cmp-radar" aria-label="Perfil superpuesto">
      <h3>Perfil superpuesto</h3>
      <svg viewBox="0 0 240 240" role="img" aria-label={`Perfil superpuesto. ${descripcion}`}>
        {[0.25, 0.5, 0.75, 1].map((escala) => (
          <polygon key={escala} className="cmp-anillo" points={poligono(referencia.map((_, i) => punto(i, total, RADIO * escala)))} />
        ))}
        {referencia.map((eje, i) => {
          const [x, y] = punto(i, total, RADIO)
          return <line key={eje.clave} className="cmp-eje" x1={CENTRO} y1={CENTRO} x2={x} y2={y} />
        })}
        {columnas.map((columna, c) => {
          const datos = referencia.map((_, i) => punto(i, total, RADIO * fraccion(valores[c * total + i])))
          return (
            <g key={columna.clave} style={{ '--color': COLORES[c] }}>
              <polygon className="cmp-area" points={poligono(datos)} />
              {datos.map(([x, y], i) => (
                <circle key={referencia[i].clave} className="cmp-vertice" cx={x} cy={y} r="3.2" />
              ))}
            </g>
          )
        })}
        {referencia.map((eje, i) => {
          const [x, y] = punto(i, total, RADIO + 17)
          return (
            <text key={eje.clave} className="cmp-etiqueta" x={x} y={y} textAnchor="middle" dominantBaseline="central">
              {eje.clave}
            </text>
          )
        })}
      </svg>
      <ul className="cmp-leyenda">
        {columnas.map((columna, c) => (
          <li key={columna.clave}>
            <span aria-hidden="true" style={{ background: COLORES[c] }} />
            {columna.titulo}
          </li>
        ))}
      </ul>
      <p className="cmp-escala">Escala ajustada de {bajo} a {alto}.</p>
    </section>
  )
}

function Valor({ valor, unidad, resumen }) {
  if (valor === null) return <span className="cmp-sin">{resumen.status === 'ready' ? 'Sin datos' : '—'}</span>
  return (
    <strong className="cmp-valor">
      {numero.format(valor)}
      {unidad && <small>{unidad}</small>}
    </strong>
  )
}

export function TablaComparacion({ caption, columnas }) {
  const unidades = useUnidades()
  const resumenes = columnas.map((columna) => columna.resumen)
  const secciones = filasDeComparacion(resumenes, unidades)
  const n = columnas.length
  return (
    <>
      <table className="cmp-tabla" style={{ '--n': n }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="sr-only">
          <tr>
            {columnas.map((columna) => (
              <th key={columna.clave} scope="col">{columna.titulo}</th>
            ))}
          </tr>
        </thead>
        {secciones.map((seccion) => (
          <tbody key={seccion.titulo}>
            <tr className="cmp-seccion">
              <th colSpan={n} scope="colgroup">{seccion.titulo}</th>
            </tr>
            {seccion.filas.map((fila) => (
              <tr key={fila.clave}>
                {fila.valores.map((valor, i) => (
                  <td key={columnas[i].clave}>
                    <Valor valor={valor} unidad={fila.unidad} resumen={columnas[i].resumen} />
                    <span className="cmp-etiqueta-fila">{fila.etiqueta}</span>
                    {valor !== null && valor === fila.mejor ? (
                      <em className="cmp-mejor">{fila.empate ? 'Empate' : 'Mejor'}</em>
                    ) : (
                      <em className="cmp-mejor cmp-mejor--hueco" aria-hidden="true">&nbsp;</em>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="players-footnote cmp-nota">Partidos y golpes medidos indican el volumen de datos. En dobles faltas se destaca el menor valor.</p>
    </>
  )
}

export function MarcoComparacion({ n, cabeceras, children }) {
  const id = useId()
  return (
    <div className="cmp-marco" style={{ '--n': n }} aria-labelledby={id}>
      <span id={id} className="sr-only">Comparación</span>
      <div className="cmp-barra" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} style={{ background: COLORES[i] }} />
        ))}
      </div>
      <div className="cmp-cabeza" role="group" aria-label="Columnas del comparador">
        {cabeceras}
      </div>
      {children}
    </div>
  )
}
