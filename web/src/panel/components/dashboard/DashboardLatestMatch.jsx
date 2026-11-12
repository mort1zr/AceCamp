import { useId } from 'react'
import { useUnidades } from '../../hooks/useUnidades.js'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'
import { resultadoDelPartido } from '../../lib/partido.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import { DatoGrafico, tarjetaGrafico, tituloGrafico, Unidad } from './DatoGrafico.jsx'

const decimal = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const entero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })
const hayTexto = (valor) => typeof valor === 'string' && valor.trim() !== ''
const valido = (valor) => Number.isFinite(valor) && valor >= 0

export default function DashboardLatestMatch({ match }) {
  const id = useId()
  const unidades = useUnidades()
  const resultado = resultadoDelPartido(match.result)
  const velocidad = (valor, formato) =>
    valido(valor) ? (
      <>
        {formato.format(convertirVelocidad(valor, unidades))}
        <Unidad>{etiquetaVelocidad(unidades)}</Unidad>
      </>
    ) : (
      'Sin datos'
    )
  const detalle = [hayTexto(match.tournament) && match.tournament.trim()].filter(Boolean)

  return (
    <section className={`${tarjetaGrafico} flex flex-col gap-4`} aria-labelledby={id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={id} className={tituloGrafico}>
          Último partido
        </h2>
        {resultado && (
          <span
            className={`inline-flex items-center gap-2 rounded-full bg-surface2 px-3 py-1.5 text-[13px] font-semibold ${resultado === 'gano' ? 'text-good' : 'text-bad'}`}
          >
            <span aria-hidden="true" className="size-2.5 rounded-full bg-current" />
            {resultado === 'gano' ? 'Ganó' : 'Perdió'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="font-display text-[26px] leading-tight font-bold break-words">
            vs. {hayTexto(match.opponent) ? match.opponent : 'Rival sin registrar'}
          </p>
          <p className="text-[14px] text-muted">
            {detalle.map((texto) => (
              <span key={texto}>
                <span>{texto}</span> ·{' '}
              </span>
            ))}
            <time dateTime={match.date}>{formatMatchDate(match.date)}</time>
          </p>
        </div>
        {hayTexto(match.result) && (
          <p className="font-display text-[38px] leading-none font-bold tracking-[0.02em] tabular-nums">
            {match.result.trim()}
          </p>
        )}
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-2.5">
        <DatoGrafico etiqueta="Saque máx.">{velocidad(match.serveMaxSpeed, entero)}</DatoGrafico>
        <DatoGrafico etiqueta="1er saque">
          {valido(match.firstServeRate) ? `${entero.format(match.firstServeRate)}%` : 'Sin datos'}
        </DatoGrafico>
        <DatoGrafico etiqueta="Dobles faltas">
          {valido(match.doubleFaults) ? match.doubleFaults : 'Sin datos'}
        </DatoGrafico>
        <DatoGrafico etiqueta="Peloteo más largo">
          {valido(match.longestRally) ? match.longestRally : 'Sin datos'}
          {valido(match.longestRally) && <Unidad>golpes</Unidad>}
        </DatoGrafico>
        <DatoGrafico etiqueta="Golpes medidos">
          {Number.isSafeInteger(match.measuredShots) && match.measuredShots >= 0
            ? entero.format(match.measuredShots)
            : 'Sin datos'}
        </DatoGrafico>
        <DatoGrafico etiqueta="Vel. media de golpe">
          {velocidad(match.averageShotSpeed, decimal)}
        </DatoGrafico>
      </dl>
    </section>
  )
}
