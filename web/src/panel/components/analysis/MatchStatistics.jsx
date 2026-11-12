import { useId } from 'react'
import { useUnidades } from '../../hooks/useUnidades.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'
import { TarjetasEstadisticas } from '../TarjetaEstadistica.jsx'

export default function MatchStatistics({ match }) {
  const units = useUnidades()
  const headingId = useId()
  const speed = (id, label) => ({
    id, label, value: convertirVelocidad(match[id], units), unit: etiquetaVelocidad(units),
  })

  const playerCards = [
    { id: 'measuredShots', label: 'Golpes medidos', value: match.measuredShots, description: 'Golpes con velocidad medible; puede ser menor que el total de golpes.' },
    speed('averageShotSpeed', 'Velocidad media de golpe'),
    speed('maxShotSpeed', 'Velocidad máxima de golpe'),
    { id: 'distanceMeters', label: 'Distancia recorrida', value: match.distanceMeters, unit: 'm' },
    speed('avgMovementSpeed', 'Velocidad media de desplazamiento'),
    speed('maxMovementSpeed', 'Velocidad máxima de desplazamiento'),
    { id: 'serveCount', label: 'Saques detectados', value: match.serveCount },
    speed('averageServeSpeed', 'Velocidad media de saque'),
    { id: 'firstServeInRate', label: 'Primer saque dentro', value: match.firstServeInRate, unit: '%' },
    { id: 'doubleFaults', label: 'Dobles faltas', value: match.doubleFaults },
  ].filter(card => Number.isFinite(card.value))

  const rallyCards = [
    { id: 'ralliesCount', label: 'Peloteos detectados', value: match.ralliesCount },
    { id: 'averageRallyShots', label: 'Golpes por peloteo', value: match.averageRallyShots },
    { id: 'longestRally', label: 'Peloteo más largo', value: match.longestRally, unit: 'golpes' },
  ].filter(card => Number.isFinite(card.value))

  if (playerCards.length === 0 && rallyCards.length === 0) {
    return (
      <section aria-labelledby={headingId}>
        <h3 id={headingId} className="mb-3 font-semibold">Indicadores del jugador</h3>
        <p className="text-sm text-muted">Sin datos de estadísticas.</p>
      </section>
    )
  }

  return (
    <>
      {playerCards.length > 0 && (
        <section aria-labelledby={headingId}>
          <h3 id={headingId} className="mb-3 font-semibold">Indicadores del jugador</h3>
          <TarjetasEstadisticas cards={playerCards} />
          <p className="mt-3 text-sm text-muted">
            Las medidas son estimaciones del modelo.
            {Number.isFinite(match.averageServeSpeed) && ' La velocidad de saque se mide hasta el bote y puede diferir de la de un radar.'}
          </p>
        </section>
      )}
      {rallyCards.length > 0 && (
        <section aria-labelledby={headingId + '-rallies'}>
          <h3 id={headingId + '-rallies'} className="mb-3 font-semibold">Peloteos del partido</h3>
          <TarjetasEstadisticas cards={rallyCards} />
        </section>
      )}
    </>
  )
}
