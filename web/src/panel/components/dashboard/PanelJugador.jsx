import { useContador } from '../../hooks/useContador.js'
import { useValoresAnimados } from '../../hooks/useValoresAnimados.js'
import { playerAge } from '../../lib/players.js'
import { valoracionJugador } from '../../lib/valoracion.js'
import './panelJugador.css'

const CENTRO = 120
const RADIO = 76

function color(valor) {
  if (valor >= 90) return 'var(--accent)'
  if (valor >= 80) return 'var(--electric)'
  return 'var(--series1)'
}

function punto(indice, total, radio) {
  const angulo = -Math.PI / 2 + (indice * 2 * Math.PI) / total
  return [CENTRO + Math.cos(angulo) * radio, CENTRO + Math.sin(angulo) * radio]
}

const poligono = (puntos) => puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

function Radar({ ejes }) {
  const valores = useValoresAnimados(ejes.map((eje) => eje.valor))
  const total = ejes.length
  const datos = valores.map((valor, i) => punto(i, total, (RADIO * valor) / 100))
  const descripcion = ejes
    .map((eje) => `${eje.nombre} ${eje.valor == null ? 'sin datos' : eje.valor}`)
    .join(', ')

  return (
    <svg
      viewBox="0 0 240 240"
      className="panel-jugador-radar"
      role="img"
      aria-label={`Radar de atributos: ${descripcion}`}
    >
      {[0.25, 0.5, 0.75, 1].map((escala) => (
        <polygon
          key={escala}
          className="panel-jugador-anillo"
          points={poligono(ejes.map((_, i) => punto(i, total, RADIO * escala)))}
        />
      ))}
      {ejes.map((eje, i) => {
        const [x, y] = punto(i, total, RADIO)
        return (
          <line
            key={eje.clave}
            className="panel-jugador-eje"
            x1={CENTRO}
            y1={CENTRO}
            x2={x}
            y2={y}
          />
        )
      })}
      <polygon className="panel-jugador-area" points={poligono(datos)} />
      {datos.map(([x, y], i) => (
        <circle key={ejes[i].clave} className="panel-jugador-vertice" cx={x} cy={y} r="3.4" />
      ))}
      {ejes.map((eje, i) => {
        const [x, y] = punto(i, total, RADIO + 17)
        return (
          <text
            key={eje.clave}
            className="panel-jugador-etiqueta"
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {eje.clave}
          </text>
        )
      })}
    </svg>
  )
}

function FilaAtributo({ eje }) {
  const medido = typeof eje.valor === 'number'
  const actual = useContador(medido ? eje.valor : null, { duracion: 800 })
  const valor = medido ? (typeof actual === 'number' ? actual : eje.valor) : 0
  return (
    <li className="panel-jugador-fila">
      <span className="panel-jugador-clave">{eje.clave}</span>
      <span className="panel-jugador-nombre">{eje.nombre}</span>
      <span className="panel-jugador-barra" aria-hidden="true">
        <span
          className="panel-jugador-relleno"
          style={{ width: `${valor}%`, background: color(valor) }}
        />
      </span>
      <span className="panel-jugador-valor">{medido ? Math.round(valor) : '—'}</span>
    </li>
  )
}

function Destacado({ etiqueta, eje, tono }) {
  if (!eje) return null
  return (
    <div className={`panel-jugador-destacado panel-jugador-destacado--${tono}`}>
      <p>{etiqueta}</p>
      <strong>
        {eje.nombre} <span>{eje.valor}</span>
      </strong>
    </div>
  )
}

export default function PanelJugador({ player, metrics, ranking, total }) {
  const nombre =
    typeof player.fullName === 'string' && player.fullName.trim() ? player.fullName : 'Sin nombre'
  const edad = playerAge(player.birthDate)
  const partidos = metrics?.analyzedMatches
  const { atributos, nivel } = valoracionJugador(player, metrics)
  const ejes = [...atributos, { clave: 'NIV', nombre: 'Nivel UTR', valor: nivel }]
  const medidos = ejes.filter((eje) => typeof eje.valor === 'number')
  const mejor = medidos.length > 1 ? medidos.reduce((a, b) => (b.valor > a.valor ? b : a)) : null
  const peor = medidos.length > 1 ? medidos.reduce((a, b) => (b.valor < a.valor ? b : a)) : null
  const juego = [player.dominantHand, player.backhand && `revés a ${player.backhand}`]
    .filter(Boolean)
    .join(' · ')
  const etiquetas = [
    edad == null ? 'Edad sin registrar' : `${edad} años`,
    juego,
    player.utr == null ? null : `UTR ${player.utr}`,
  ].filter(Boolean)

  return (
    <div className="panel-jugador">
      <div className="panel-jugador-principal">
        <p className="panel-jugador-aviso">
          <span aria-hidden="true" className="panel-jugador-punto" />
          Jugador seleccionado
        </p>
        <h2 className="panel-jugador-titulo">{nombre}</h2>
        <ul className="panel-jugador-etiquetas">
          {etiquetas.map((etiqueta) => (
            <li key={etiqueta}>{etiqueta}</li>
          ))}
        </ul>
        <div className="panel-jugador-destacados">
          <Destacado etiqueta="Fortaleza" eje={mejor} tono="fuerte" />
          <Destacado etiqueta="A mejorar" eje={peor} tono="debil" />
          {ranking != null && total > 0 && (
            <div className="panel-jugador-destacado panel-jugador-destacado--puesto">
              <p>Puesto del equipo</p>
              <strong>
                #{ranking} <span>de {total}</span>
              </strong>
            </div>
          )}
        </div>
        <ul className="panel-jugador-atributos">
          {ejes.map((eje) => (
            <FilaAtributo key={eje.clave} eje={eje} />
          ))}
        </ul>
        <p className="panel-jugador-nota">
          {partidos > 0
            ? `Valoración calculada con ${partidos} ${partidos === 1 ? 'partido analizado' : 'partidos analizados'}${player.utr == null ? '' : ' y su UTR'}.`
            : 'La valoración aparecerá cuando tenga partidos analizados.'}
        </p>
      </div>
      <div className="panel-jugador-lateral">
        <p className="panel-jugador-subtitulo">Radar de habilidades</p>
        <Radar ejes={ejes} />
      </div>
    </div>
  )
}
