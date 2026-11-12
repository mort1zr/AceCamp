const COLORES = { azul: '#5a93d8', oliva: '#8e9a1c', arcilla: '#d0623a', teal: '#00708f' }

export function PdfApilada({ segmentos }) {
  return (
    <>
      <div
        className="rp-apilada"
        role="img"
        aria-label={segmentos.map((s) => `${s.etiqueta} ${s.porcentaje}%`).join(', ')}
      >
        {segmentos.map((segmento) => (
          <span
            key={segmento.etiqueta}
            style={{ width: `${segmento.porcentaje}%`, background: COLORES[segmento.color] }}
          />
        ))}
      </div>
      <ul className="rp-leyenda">
        {segmentos.map((segmento) => (
          <li key={segmento.etiqueta}>
            <span aria-hidden="true" style={{ background: COLORES[segmento.color] }} />
            <p>{segmento.etiqueta}</p>
            <strong>{segmento.porcentaje}%</strong>
          </li>
        ))}
      </ul>
    </>
  )
}

const CENTRO = 120
const RADIO = 74

function punto(indice, total, radio) {
  const angulo = -Math.PI / 2 + (indice * 2 * Math.PI) / total
  return [CENTRO + Math.cos(angulo) * radio, CENTRO + Math.sin(angulo) * radio]
}

const poligono = (puntos) => puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

export function PdfRadar({ ejes }) {
  const total = ejes.length
  const datos = ejes.map((eje, i) => punto(i, total, (RADIO * (eje.valor ?? 0)) / 100))
  return (
    <svg
      className="rp-grafico rp-radar"
      viewBox="0 0 240 240"
      role="img"
      aria-label="Radar de atributos del jugador"
    >
      {[0.25, 0.5, 0.75, 1].map((escala) => (
        <polygon
          key={escala}
          points={poligono(ejes.map((_, i) => punto(i, total, RADIO * escala)))}
          fill="none"
          stroke="#e4ded4"
        />
      ))}
      {ejes.map((eje, i) => {
        const [x, y] = punto(i, total, RADIO)
        return <line key={eje.clave} x1={CENTRO} y1={CENTRO} x2={x} y2={y} stroke="#e4ded4" />
      })}
      <polygon
        points={poligono(datos)}
        fill="rgba(0, 112, 143, 0.22)"
        stroke={COLORES.teal}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {datos.map(([x, y], i) => (
        <circle
          key={ejes[i].clave}
          cx={x}
          cy={y}
          r="3"
          fill="#fff"
          stroke={COLORES.teal}
          strokeWidth="1.6"
        />
      ))}
      {ejes.map((eje, i) => {
        const [x, y] = punto(i, total, RADIO + 17)
        return (
          <text
            key={eje.clave}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight="700"
            fontSize="13"
          >
            {eje.clave}
          </text>
        )
      })}
    </svg>
  )
}

const ANCHO = 109.7
const LARGO = 118.9

export function PdfMapaCalor({ heatmap }) {
  const { columns, rows, cells } = heatmap
  const maximo = Math.max(1, ...cells)
  const linea = { stroke: '#1a1815', strokeOpacity: 0.5, strokeWidth: 0.8, fill: 'none' }
  return (
    <svg
      className="rp-grafico rp-mapa"
      viewBox={`-6 -14 ${ANCHO + 12} ${LARGO + 20}`}
      role="img"
      aria-label="Mapa de calor de la mitad de la cancha del jugador, con la red arriba"
    >
      <rect x="0" y="0" width={ANCHO} height={LARGO} fill="#f6f4ef" />
      {cells.map((valor, i) => (
        <rect
          key={i}
          x={(i % columns) * (ANCHO / columns)}
          y={Math.floor(i / columns) * (LARGO / rows)}
          width={ANCHO / columns}
          height={LARGO / rows}
          fill={COLORES.arcilla}
          fillOpacity={valor === 0 ? 0 : 0.12 + 0.88 * (valor / maximo) ** 0.7}
        />
      ))}
      <rect x="0" y="0" width={ANCHO} height={LARGO} {...linea} />
      <line x1="13.7" y1="0" x2="13.7" y2={LARGO} {...linea} />
      <line x1={ANCHO - 13.7} y1="0" x2={ANCHO - 13.7} y2={LARGO} {...linea} />
      <line x1="13.7" y1="64" x2={ANCHO - 13.7} y2="64" {...linea} />
      <line x1={ANCHO / 2} y1="0" x2={ANCHO / 2} y2="64" {...linea} />
      <line x1="0" y1="0" x2={ANCHO} y2="0" stroke="#1a1815" strokeWidth="2.4" />
      <text x="0" y="-5" fontSize="7" fontWeight="700" fill="#6b6358">
        RED
      </text>
    </svg>
  )
}
