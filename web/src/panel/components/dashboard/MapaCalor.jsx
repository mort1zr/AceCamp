const ANCHO = 109.7
const LARGO = 118.9
const MARGEN = 6

export default function MapaCalor({ heatmap }) {
  const { columns, rows, cells } = heatmap
  const maximo = Math.max(1, ...cells)
  const anchoCelda = ANCHO / columns
  const altoCelda = LARGO / rows
  const linea = { stroke: 'var(--text)', strokeOpacity: 0.55, strokeWidth: 0.8, fill: 'none' }

  return (
    <svg
      viewBox={`${-MARGEN} ${-MARGEN - 8} ${ANCHO + MARGEN * 2} ${LARGO + MARGEN * 2 + 8}`}
      className="w-full max-w-[19rem]"
      role="img"
      aria-label="Mapa de calor de la mitad de la cancha del jugador, con la red arriba"
    >
      <rect x="0" y="0" width={ANCHO} height={LARGO} fill="var(--surface2)" />
      {cells.map((valor, i) => (
        <rect
          key={i}
          x={(i % columns) * anchoCelda}
          y={Math.floor(i / columns) * altoCelda}
          width={anchoCelda}
          height={altoCelda}
          fill="var(--series1)"
          fillOpacity={valor === 0 ? 0 : 0.12 + 0.88 * (valor / maximo) ** 0.7}
        />
      ))}
      <rect x="0" y="0" width={ANCHO} height={LARGO} {...linea} />
      <line x1="13.7" y1="0" x2="13.7" y2={LARGO} {...linea} />
      <line x1={ANCHO - 13.7} y1="0" x2={ANCHO - 13.7} y2={LARGO} {...linea} />
      <line x1="13.7" y1="64" x2={ANCHO - 13.7} y2="64" {...linea} />
      <line x1={ANCHO / 2} y1="0" x2={ANCHO / 2} y2="64" {...linea} />
      <line x1="0" y1="0" x2={ANCHO} y2="0" stroke="var(--text)" strokeWidth="2.4" />
      <text x="0" y="-5" fill="var(--muted)" fontSize="7" fontWeight="700" letterSpacing="1">
        RED
      </text>
    </svg>
  )
}
