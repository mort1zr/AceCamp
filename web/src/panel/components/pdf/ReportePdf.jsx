import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { iniciales } from '../../lib/reportePdf.js'
import './reportePdf.css'

const fechaLarga = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const cifra = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

export function BotonPdf({
  onClick,
  disabled,
  children = 'Exportar PDF',
  className = 'players-button-secondary',
}) {
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
      {children}
    </button>
  )
}

function LogoPdf() {
  return (
    <svg width="22" height="22" viewBox="0 0 30 30" aria-hidden="true">
      <path d="M3 25h24" stroke="#b9b0a2" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="15" cy="24.6" rx="6" ry="1.6" fill="#d0623a" />
      <circle cx="15" cy="12" r="7.5" fill="#d7f25c" stroke="#5a6b00" strokeWidth="0.8" />
      <path
        d="M9.6 7.4c2.9 2.4 2.9 6.8 0 9.2M20.4 7.4c-2.9 2.4-2.9 6.8 0 9.2"
        stroke="#12110f"
        strokeWidth="1.4"
        fill="none"
      />
    </svg>
  )
}

export function PdfSeccion({ titulo, nota, children }) {
  return (
    <section className="rp-seccion">
      <div className="rp-seccion-cabeza">
        <h2>{titulo}</h2>
        {nota && <p className="rp-nota">{nota}</p>}
      </div>
      {children}
    </section>
  )
}

export function PdfKpis({ items }) {
  return (
    <div className="rp-kpis">
      {items.map(({ etiqueta, valor, unidad, tendencia }) => (
        <div key={etiqueta} className="rp-kpi">
          <p className="rp-kpi-etiqueta">{etiqueta}</p>
          {valor == null ? (
            <p className="rp-kpi-valor rp-kpi-vacio">—</p>
          ) : (
            <p className="rp-kpi-valor">
              {valor}
              {unidad && <small>{unidad}</small>}
            </p>
          )}
          {tendencia && <p className="rp-kpi-tendencia">{tendencia}</p>}
        </div>
      ))}
    </div>
  )
}

export function PdfBarras({ filas, sufijo = '', vacio = 'Sin datos para este periodo.' }) {
  if (filas.every((fila) => fila.valor == null)) return <PdfVacio>{vacio}</PdfVacio>
  const maximo = Math.max(1, ...filas.map((fila) => fila.valor ?? 0))
  return (
    <dl className="rp-barras">
      {filas.map(({ etiqueta, valor }) => (
        <div key={etiqueta} className="rp-barra">
          <dt>{etiqueta}</dt>
          <dd className="rp-barra-pista">
            <div
              className="rp-barra-relleno"
              style={{ width: `${((valor ?? 0) / maximo) * 100}%` }}
            />
          </dd>
          <dd className="rp-barra-cifra">{valor == null ? '—' : `${cifra.format(valor)}${sufijo}`}</dd>
        </div>
      ))}
    </dl>
  )
}

function dominio(valores) {
  if (valores.length === 0) return [0, 10]
  const minimo = Math.min(...valores)
  const maximo = Math.max(...valores)
  const margen = Math.max(2, (maximo - minimo) * 0.25)
  return [Math.max(0, Math.floor((minimo - margen) / 5) * 5), Math.ceil((maximo + margen) / 5) * 5]
}

export function PdfLinea({ puntos, color = '#00708f', titulo, ancho = 640 }) {
  const alto = 170
  const izq = 52
  const der = 20
  const arriba = 18
  const abajo = 24
  const medidos = puntos.filter((punto) => punto.valor != null)
  const [minimo, maximo] = dominio(medidos.map((punto) => punto.valor))
  const x = (i) =>
    izq +
    (puntos.length === 1
      ? (ancho - izq - der) / 2
      : (i * (ancho - izq - der)) / (puntos.length - 1))
  const y = (valor) => arriba + (1 - (valor - minimo) / (maximo - minimo)) * (alto - arriba - abajo)
  const tramos = []
  let tramo = []
  puntos.forEach((punto, i) => {
    if (punto.valor == null) {
      if (tramo.length) tramos.push(tramo)
      tramo = []
    } else tramo.push(`${x(i)},${y(punto.valor)}`)
  })
  if (tramo.length) tramos.push(tramo)
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((parte) => minimo + parte * (maximo - minimo))
  const conValores = puntos.length <= 12

  return (
    <svg className="rp-grafico" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={titulo}>
      {marcas.map((marca) => (
        <g key={marca}>
          <line
            x1={36}
            x2={ancho - 6}
            y1={y(marca)}
            y2={y(marca)}
            stroke="#e4ded4"
            strokeDasharray={marca !== minimo ? '3 3' : undefined}
          />
          <text x={30} y={y(marca) + 3} textAnchor="end">
            {cifra.format(marca)}
          </text>
        </g>
      ))}
      {tramos.map((lista) => (
        <polyline
          key={lista[0]}
          points={lista.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ))}
      {puntos.map((punto, i) => (
        <g key={punto.clave}>
          {punto.valor != null && <circle cx={x(i)} cy={y(punto.valor)} r="3.5" fill={color} />}
          {punto.valor != null && conValores && (
            <text className="rp-valor" x={x(i)} y={y(punto.valor) - 8} textAnchor="middle">
              {cifra.format(punto.valor)}
            </text>
          )}
          <text x={x(i)} y={alto - 8} textAnchor="middle">
            {punto.etiqueta}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function PdfVacio({ children }) {
  return <p className="rp-vacio">{children}</p>
}

export default function ReportePdf({
  tipo,
  organizacion,
  archivo,
  encabezado,
  listo = true,
  onTerminar,
  children,
}) {
  useEffect(() => {
    if (!listo) return undefined
    const anterior = document.title
    document.title = archivo
    const terminar = () => {
      document.title = anterior
      onTerminar()
    }
    window.addEventListener('afterprint', terminar, { once: true })
    const cuadro = requestAnimationFrame(() => window.print())
    return () => {
      cancelAnimationFrame(cuadro)
      window.removeEventListener('afterprint', terminar)
      document.title = anterior
    }
  }, [listo, archivo, onTerminar])

  const org = organizacion || 'Tu organización'
  const [generado] = useState(() => fechaLarga.format(new Date()))

  return createPortal(
    <div className="reporte-pdf" aria-hidden="true">
      <header className="rp-cabecera">
        <span className="rp-marca">
          <LogoPdf />
          AceCam
        </span>
        <div className="rp-org">
          <div>
            <p className="rp-org-nombre">{org}</p>
            <p className="rp-org-tipo">{tipo}</p>
          </div>
          <span className="rp-sello">{iniciales(org)}</span>
        </div>
      </header>
      {encabezado}
      {children}
      <footer className="rp-pie">
        <p>Generado el {generado} con AceCam</p>
        <p>
          Las medidas son estimaciones del modelo a partir del video. «—» indica que no hay datos.
        </p>
      </footer>
    </div>,
    document.body,
  )
}
