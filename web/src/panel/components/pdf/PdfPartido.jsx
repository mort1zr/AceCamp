import { useEffect, useState } from 'react'
import ReportePdf, { PdfKpis, PdfSeccion, PdfVacio } from './ReportePdf.jsx'
import { nombreArchivo, setsDelMarcador } from '../../lib/reportePdf.js'
import { useUnidades } from '../../hooks/useUnidades.js'
import { formatMatchDate } from '../../lib/dashboardEvolution.js'
import { convertirVelocidad, etiquetaVelocidad } from '../../lib/unidades.js'

const cifra = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function Cancha() {
  return (
    <svg
      className="rp-grafico"
      viewBox="0 0 240 132"
      role="img"
      aria-label="Cancha de tenis vista desde arriba"
    >
      <rect
        x="6"
        y="6"
        width="228"
        height="120"
        rx="3"
        fill="#f6f4ef"
        stroke="#b9b0a2"
        strokeWidth="1.5"
      />
      <rect x="6" y="20" width="228" height="92" fill="none" stroke="#b9b0a2" />
      <line x1="120" y1="6" x2="120" y2="126" stroke="#1a1815" strokeWidth="2" />
      <line x1="66" y1="20" x2="66" y2="112" stroke="#b9b0a2" />
      <line x1="174" y1="20" x2="174" y2="112" stroke="#b9b0a2" />
      <line x1="66" y1="66" x2="174" y2="66" stroke="#b9b0a2" />
    </svg>
  )
}

export default function PdfPartido({ match, playerName, organizacion, notesService, onTerminar }) {
  const unidades = useUnidades()
  const [notas, setNotas] = useState(notesService ? null : '')
  const rival = match.opponent || 'Rival sin registrar'
  const sets = setsDelMarcador(match.result)

  useEffect(() => {
    if (!notesService) return undefined
    let activo = true
    notesService.load(match.id).then(
      (texto) => activo && setNotas(texto ?? ''),
      () => activo && setNotas(''),
    )
    return () => {
      activo = false
    }
  }, [notesService, match.id])

  const velocidad = (etiqueta, valor) => ({
    etiqueta,
    valor: valor == null ? null : cifra.format(convertirVelocidad(valor, unidades)),
    unidad: etiquetaVelocidad(unidades),
  })
  const numero = (etiqueta, valor, unidad) => ({
    etiqueta,
    valor: valor == null ? null : cifra.format(valor),
    unidad,
  })

  const encabezado = (
    <section className="rp-portada">
      <div>
        <p className="rp-eyebrow">Reporte del partido · {formatMatchDate(match.matchDate)}</p>
        <h1>
          {playerName} <span style={{ color: '#6b6358' }}>vs.</span> {rival}
        </h1>
        <ul className="rp-chips">
          <li>{match.tournament || 'Torneo sin registrar'}</li>
          {match.surface && <li className="capitalize">{match.surface}</li>}
          <li>Marcador {match.result || 'sin registrar'}</li>
        </ul>
      </div>
    </section>
  )

  return (
    <ReportePdf
      tipo="Reporte del partido"
      organizacion={organizacion}
      archivo={nombreArchivo('Partido', playerName, `vs ${rival}`, match.matchDate)}
      encabezado={encabezado}
      listo={notas !== null}
      onTerminar={onTerminar}
    >
      <div className="rp-columnas">
        <PdfSeccion titulo="Marcador por set">
          {sets.length ? (
            <table className="rp-tabla">
              <thead>
                <tr>
                  <th scope="col">Set</th>
                  <th scope="col" className="rp-num">
                    {playerName}
                  </th>
                  <th scope="col" className="rp-num">
                    {rival}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sets.map((set, i) => (
                  <tr key={i}>
                    <th scope="row">{i + 1}</th>
                    <td className={`rp-num ${set.propios > set.rival ? 'rp-gana' : ''}`}>
                      {set.propios}
                      {set.tiebreak && set.propios < set.rival ? <sup>{set.tiebreak}</sup> : null}
                    </td>
                    <td className={`rp-num ${set.rival > set.propios ? 'rp-gana' : ''}`}>
                      {set.rival}
                      {set.tiebreak && set.rival < set.propios ? <sup>{set.tiebreak}</sup> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <PdfVacio>El marcador de este partido no está registrado.</PdfVacio>
          )}
        </PdfSeccion>
        <PdfSeccion titulo="Mapa de piques del saque">
          <div className="rp-tarjeta">
            <Cancha />
            <p className="rp-nota" style={{ marginTop: 6 }}>
              El modelo aún no publica la posición de cada pique, así que el mapa queda vacío.
            </p>
          </div>
        </PdfSeccion>
      </div>

      <PdfSeccion titulo="Golpes y movimiento">
        <PdfKpis
          items={[
            numero('Golpes medidos', match.measuredShots),
            velocidad('Velocidad media de golpe', match.averageShotSpeed),
            velocidad('Velocidad máxima de golpe', match.maxShotSpeed),
            numero('Distancia recorrida', match.distanceMeters, 'm'),
            velocidad('Desplazamiento medio', match.avgMovementSpeed),
            velocidad('Desplazamiento máximo', match.maxMovementSpeed),
          ]}
        />
      </PdfSeccion>

      <PdfSeccion titulo="Saque" nota="Velocidad medida hasta el bote; puede diferir de un radar">
        <PdfKpis
          items={[
            numero('Saques detectados', match.serveCount),
            velocidad('Velocidad media de saque', match.averageServeSpeed),
            numero('Primer saque dentro', match.firstServeInRate, '%'),
            numero('Dobles faltas', match.doubleFaults),
          ]}
        />
      </PdfSeccion>

      <PdfSeccion titulo="Peloteos">
        <PdfKpis
          items={[
            numero('Peloteos detectados', match.ralliesCount),
            numero('Golpes por peloteo', match.averageRallyShots),
            numero('Peloteo más largo', match.longestRally, 'golpes'),
          ]}
        />
      </PdfSeccion>

      <PdfSeccion titulo="Notas del entrenador">
        {notas ? (
          <p className="rp-notas">{notas}</p>
        ) : (
          <PdfVacio>Sin notas para este partido.</PdfVacio>
        )}
      </PdfSeccion>
    </ReportePdf>
  )
}
