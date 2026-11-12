import { useId } from 'react'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import { DatoGrafico, tarjetaGrafico, tituloGrafico, Unidad } from './DatoGrafico.jsx'
import MapaCalor from './MapaCalor.jsx'

const decimal = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

export default function MovimientoCard({ movement }) {
  const id = useId()
  const unidades = useUnidades()
  const velocidad = (valor) =>
    valor == null ? 'Sin datos' : decimal.format(convertirVelocidad(valor, unidades))
  const distancia = movement?.distancePerMatch
  const hay =
    distancia != null || movement?.maxSpeedKmh != null || movement?.averageSpeedKmh != null

  return (
    <section className={`${tarjetaGrafico} flex flex-col gap-4`} aria-labelledby={id}>
      <div>
        <h2 id={id} className={tituloGrafico}>
          Físico y movimiento
        </h2>
        <p className="mt-1 text-[13px] text-muted">
          {movement?.heatmap
            ? 'Dónde pasa más tiempo en su lado de la cancha'
            : 'Distancia y velocidad de desplazamiento'}
        </p>
      </div>
      {hay ? (
        <div className="flex flex-wrap items-center gap-5">
          {movement?.heatmap && (
            <div className="flex min-w-48 flex-1 flex-col items-center gap-2">
              <MapaCalor heatmap={movement.heatmap} />
              <div className="flex items-center gap-2 text-[12px] text-muted" aria-hidden="true">
                Menos
                {[0.2, 0.45, 0.7, 1].map((opacidad) => (
                  <span
                    key={opacidad}
                    className="size-3.5 rounded-[3px]"
                    style={{ background: 'var(--series1)', opacity: opacidad }}
                  />
                ))}
                Más
              </div>
            </div>
          )}
          <dl className="grid min-w-44 flex-1 gap-2.5">
            <DatoGrafico etiqueta="Distancia / partido">
              {distancia == null
                ? 'Sin datos'
                : distancia >= 1000
                  ? decimal.format(distancia / 1000)
                  : Math.round(distancia)}
              {distancia != null && <Unidad>{distancia >= 1000 ? 'km' : 'm'}</Unidad>}
            </DatoGrafico>
            <DatoGrafico etiqueta="Velocidad máx.">
              {velocidad(movement?.maxSpeedKmh)}
              {movement?.maxSpeedKmh != null && <Unidad>{etiquetaVelocidad(unidades)}</Unidad>}
            </DatoGrafico>
            <DatoGrafico etiqueta="Velocidad prom.">
              {velocidad(movement?.averageSpeedKmh)}
              {movement?.averageSpeedKmh != null && <Unidad>{etiquetaVelocidad(unidades)}</Unidad>}
            </DatoGrafico>
          </dl>
        </div>
      ) : (
        <p className="py-6 text-muted">Sin datos de movimiento para este periodo.</p>
      )}
    </section>
  )
}
