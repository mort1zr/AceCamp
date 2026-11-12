import './esqueleto.css'

function Bloque({ className = '' }) {
  return <span aria-hidden="true" className={`esqueleto ${className}`} />
}

export function EsqueletoJugadores() {
  return (
    <div className="esqueleto-jugadores" aria-busy="true" role="status">
      <span className="sr-only">Cargando jugadores…</span>
      {Array.from({ length: 6 }, (_, i) => (
        <Bloque key={i} className="esqueleto-carta" />
      ))}
    </div>
  )
}

export function EsqueletoResumen() {
  return (
    <div className="esqueleto-resumen" aria-busy="true" role="status">
      <span className="sr-only">Cargando resumen…</span>
      <Bloque className="esqueleto-titulo" />
      <div className="esqueleto-kpis">
        {Array.from({ length: 7 }, (_, i) => (
          <Bloque key={i} className="esqueleto-kpi" />
        ))}
      </div>
      <div className="esqueleto-graficos">
        {Array.from({ length: 4 }, (_, i) => (
          <Bloque key={i} className="esqueleto-grafico" />
        ))}
      </div>
    </div>
  )
}

export function EsqueletoTabla({ etiqueta = 'jugadores' }) {
  return (
    <div className="esqueleto-tabla" aria-busy="true" role="status">
      <span className="sr-only">Cargando {etiqueta}…</span>
      <Bloque className="esqueleto-fila esqueleto-fila--cabeza" />
      {Array.from({ length: 6 }, (_, i) => (
        <Bloque key={i} className="esqueleto-fila" />
      ))}
    </div>
  )
}

export function EsqueletoBandeja() {
  return (
    <div className="esqueleto-bandeja" aria-busy="true" role="status">
      <span className="sr-only">Cargando postulaciones…</span>
      <div className="esqueleto-lista">
        {Array.from({ length: 5 }, (_, i) => (
          <Bloque key={i} className="esqueleto-postulante" />
        ))}
      </div>
      <Bloque className="esqueleto-detalle" />
    </div>
  )
}
