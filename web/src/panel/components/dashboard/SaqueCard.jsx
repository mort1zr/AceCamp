import { useId } from 'react'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import { DatoGrafico, tarjetaGrafico, tituloGrafico, Unidad } from './DatoGrafico.jsx'

const entero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

const SEGMENTOS = [
  { clave: 'firstIn', etiqueta: '1er saque adentro', color: 'var(--series2)' },
  { clave: 'secondIn', etiqueta: '2do saque adentro', color: 'var(--series3)' },
  { clave: 'doubleFaults', etiqueta: 'Doble falta', color: 'var(--series1)' },
]

function Velocidades({ titulo, datos, unidades }) {
  const hay = datos?.averageSpeedKmh != null && datos?.maxSpeedKmh != null
  const mostrar = (valor) => entero.format(convertirVelocidad(valor, unidades))
  return (
    <div className="rounded-xl border border-line p-3.5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{titulo}</p>
      {hay ? (
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-display text-[28px] leading-none font-bold tabular-nums">
          <span>
            {mostrar(datos.averageSpeedKmh)}
            <Unidad>prom.</Unidad>
          </span>
          <span>
            {mostrar(datos.maxSpeedKmh)}
            <Unidad>máx. {etiquetaVelocidad(unidades)}</Unidad>
          </span>
        </p>
      ) : (
        <p className="mt-1.5 text-[15px] text-muted">Sin datos</p>
      )}
    </div>
  )
}

export default function SaqueCard({ serve, playerId }) {
  const id = useId()
  const unidades = useUnidades()
  const total = serve?.attempts
  const completo = total > 0 && SEGMENTOS.every(({ clave }) => serve?.[clave] != null)
  const porcentaje = (valor) => (valor / total) * 100

  return (
    <section className={`${tarjetaGrafico} flex flex-col gap-4`} aria-labelledby={id}>
      <div>
        <h2 id={id} className={tituloGrafico}>
          Saque
        </h2>
        <p className="mt-1 text-[13px] text-muted">Resultado de cada punto al saque</p>
      </div>
      {completo ? (
        <>
          <div
            key={playerId}
            className="flex h-9 gap-0.5 overflow-hidden rounded-lg"
            role="img"
            aria-label={SEGMENTOS.map(
              ({ clave, etiqueta }) => `${etiqueta} ${Math.round(porcentaje(serve[clave]))}%`,
            ).join(', ')}
          >
            {SEGMENTOS.map(({ clave, color }) => (
              <span
                key={clave}
                className="saque-segmento"
                style={{ width: `${porcentaje(serve[clave])}%`, background: color }}
              />
            ))}
          </div>
          <dl className="grid grid-cols-3 gap-2.5">
            {SEGMENTOS.map(({ clave, etiqueta, color }) => (
              <DatoGrafico
                key={clave}
                etiqueta={
                  <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
                    <span
                      aria-hidden="true"
                      className="size-2.5 rounded-[3px]"
                      style={{ background: color }}
                    />
                    {etiqueta}
                  </span>
                }
              >
                {Math.round(porcentaje(serve[clave]))}%
              </DatoGrafico>
            ))}
          </dl>
        </>
      ) : (
        <p className="py-6 text-muted">Sin datos de los resultados al saque para este periodo.</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
        <Velocidades titulo="Primer saque" datos={serve?.first} unidades={unidades} />
        <Velocidades titulo="Segundo saque" datos={serve?.second} unidades={unidades} />
      </div>
      <table className="sr-only">
        <caption>Saque: datos del periodo</caption>
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            <th scope="col">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Primeros dentro</th>
            <td>{serve?.firstIn ?? 'Sin datos'}</td>
          </tr>
          <tr>
            <th scope="row">Segundos dentro</th>
            <td>{serve?.secondIn ?? 'Sin datos'}</td>
          </tr>
          <tr>
            <th scope="row">Dobles faltas</th>
            <td>{serve?.doubleFaults ?? 'Sin datos'}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
