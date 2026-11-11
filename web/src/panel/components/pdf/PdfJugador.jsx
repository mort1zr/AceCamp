import ReportePdf, { PdfBarras, PdfKpis, PdfLinea, PdfSeccion, PdfVacio } from './ReportePdf.jsx'
import { iniciales, nombreArchivo } from '../../lib/reportePdf.js'
import { useUnidades } from '../../hooks/useUnidades.js'
import {
  completeDashboardMetricDefinitions,
  isDashboardMetricValue,
} from '../../lib/dashboardOverview.js'
import { formatMatchDate, selectEvolutionPoints } from '../../lib/dashboardEvolution.js'
import { playerAge } from '../../lib/players.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const cifra = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })
const cambio = new Intl.NumberFormat('es-PE', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})

function tendencia(metrica, valor, anterior, unidades) {
  if (!isDashboardMetricValue(metrica, anterior)) return 'Sin periodo anterior para comparar'
  const diferencia = valor - anterior
  const mostrada = metrica.speed ? convertirVelocidad(diferencia, unidades) : diferencia
  const unidad = metrica.speed
    ? ` ${etiquetaVelocidad(unidades)}`
    : metrica.unit === '%'
      ? ' p. p.'
      : metrica.unit
        ? ` ${metrica.unit}`
        : ''
  return `${cambio.format(mostrada)}${unidad} vs. periodo anterior`
}

function Evolucion({ titulo, evolucion, playerId, metrica, unidades, color }) {
  const puntos = selectEvolutionPoints(evolucion, playerId, metrica).map((punto) => ({
    clave: punto.matchId,
    etiqueta: formatMatchDate(punto.date, true),
    valor: punto[metrica] == null ? null : convertirVelocidad(punto[metrica], unidades),
  }))
  return (
    <PdfSeccion
      titulo={titulo}
      nota={`${etiquetaVelocidad(unidades)} por partido, ordenado por fecha`}
    >
      <div className="rp-tarjeta">
        {puntos.some((punto) => punto.valor != null) ? (
          <PdfLinea puntos={puntos} color={color} titulo={titulo} />
        ) : (
          <PdfVacio>Todavía no hay partidos con esta medición.</PdfVacio>
        )}
      </div>
    </PdfSeccion>
  )
}

export default function PdfJugador({ player, report, periodo, organizacion, sample, onTerminar }) {
  const unidades = useUnidades()
  const nombre = player.fullName?.trim() || 'Sin nombre'
  const edad = playerAge(player.birthDate)
  const comparar = periodo.value !== 'all'
  const etiquetaPeriodo = comparar ? periodo.label : 'Todos los partidos'
  const metricas = report?.metrics
  const ultimo = report?.latestMatch?.playerId === player.id ? report.latestMatch : null
  const { serve, rallies, movement } = report?.details ?? {}

  const kpis = completeDashboardMetricDefinitions.map((metrica) => {
    const valor = metricas?.[metrica.key]
    const valido = isDashboardMetricValue(metrica, valor)
    return {
      etiqueta: metrica.label,
      valor: valido
        ? cifra.format(metrica.speed ? convertirVelocidad(valor, unidades) : valor)
        : null,
      unidad: metrica.speed ? etiquetaVelocidad(unidades) : metrica.unit,
      tendencia:
        comparar && valido
          ? tendencia(metrica, valor, report?.previousMetrics?.[metrica.key], unidades)
          : undefined,
    }
  })

  const encabezado = (
    <section className="rp-portada">
      <span className="rp-avatar" aria-hidden="true">
        {iniciales(nombre)}
      </span>
      <div>
        <p className="rp-eyebrow">Reporte del jugador · {etiquetaPeriodo}</p>
        <h1>{nombre}</h1>
        <ul className="rp-chips">
          <li>{edad == null ? 'Edad sin registrar' : `${edad} años`}</li>
          <li>{player.academy || 'Sin academia registrada'}</li>
          {player.category && <li>{player.category}</li>}
          {player.dominantHand && <li className="capitalize">{player.dominantHand}</li>}
          {player.backhand && <li>Revés a {player.backhand}</li>}
          {sample && <li>Datos de ejemplo</li>}
        </ul>
      </div>
    </section>
  )

  return (
    <ReportePdf
      tipo="Reporte del jugador"
      organizacion={organizacion}
      archivo={nombreArchivo('Reporte', nombre, periodo.value === 'all' ? '' : periodo.label)}
      encabezado={encabezado}
      onTerminar={onTerminar}
    >
      <PdfSeccion
        titulo="Resumen de rendimiento"
        nota={
          comparar
            ? `Comparado con el periodo anterior (${periodo.label.toLowerCase()})`
            : 'Todos los partidos analizados'
        }
      >
        <PdfKpis items={kpis} />
      </PdfSeccion>

      <Evolucion
        titulo="Evolución de la velocidad de golpe"
        evolucion={report?.evolution}
        playerId={player.id}
        metrica="averageShotSpeed"
        unidades={unidades}
        color="#00708f"
      />
      <Evolucion
        titulo="Evolución de la velocidad de saque"
        evolucion={report?.serveEvolution}
        playerId={player.id}
        metrica="averageServeSpeed"
        unidades={unidades}
        color="#d0623a"
      />

      <div className="rp-columnas">
        <PdfSeccion titulo="Saque">
          <div className="rp-tarjeta">
            <PdfBarras
              filas={[
                { etiqueta: 'Primeros dentro', valor: serve?.firstIn ?? null },
                { etiqueta: 'Segundos dentro', valor: serve?.secondIn ?? null },
                { etiqueta: 'Dobles faltas', valor: serve?.doubleFaults ?? null },
              ]}
            />
          </div>
        </PdfSeccion>
        <PdfSeccion
          titulo="Peloteos"
          nota={
            rallies?.longestShots == null
              ? undefined
              : `Más largo: ${cifra.format(rallies.longestShots)} golpes`
          }
        >
          <div className="rp-tarjeta">
            <PdfBarras
              filas={[
                { etiqueta: '0–4 golpes', valor: rallies?.short ?? null },
                { etiqueta: '5–8 golpes', valor: rallies?.medium ?? null },
                { etiqueta: '9+ golpes', valor: rallies?.long ?? null },
              ]}
            />
          </div>
        </PdfSeccion>
      </div>

      <div className="rp-columnas">
        <PdfSeccion
          titulo="Último partido"
          nota={ultimo ? formatMatchDate(ultimo.date) : undefined}
        >
          {ultimo ? (
            <table className="rp-tabla">
              <tbody>
                <tr>
                  <th scope="row">Rival</th>
                  <td>{ultimo.opponent || '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Torneo</th>
                  <td>{ultimo.tournament || '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Marcador</th>
                  <td>{ultimo.result || '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Velocidad media de golpe</th>
                  <td>
                    {Number.isFinite(ultimo.averageShotSpeed)
                      ? `${cifra.format(convertirVelocidad(ultimo.averageShotSpeed, unidades))} ${etiquetaVelocidad(unidades)}`
                      : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <PdfVacio>No hay partidos analizados en este periodo.</PdfVacio>
          )}
        </PdfSeccion>
        <PdfSeccion titulo="Físico y movimiento">
          <PdfKpis
            items={[
              {
                etiqueta: 'Distancia acumulada',
                valor:
                  movement?.distanceMeters == null ? null : cifra.format(movement.distanceMeters),
                unidad: 'm',
              },
              {
                etiqueta: 'Velocidad máxima',
                valor:
                  movement?.maxSpeedKmh == null
                    ? null
                    : cifra.format(convertirVelocidad(movement.maxSpeedKmh, unidades)),
                unidad: etiquetaVelocidad(unidades),
              },
            ]}
          />
        </PdfSeccion>
      </div>

      <PdfSeccion titulo="Radar del jugador">
        <PdfVacio>
          El modelo aún no entrega puntuaciones comparables de 0 a 100, así que el radar no se
          incluye para no mostrar calificaciones inventadas.
        </PdfVacio>
      </PdfSeccion>
    </ReportePdf>
  )
}
