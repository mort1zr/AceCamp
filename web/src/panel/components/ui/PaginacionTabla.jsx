import './ui.css'

export const tamanosPagina = [10, 20, 50]

export default function PaginacionTabla({ total, page, pageSize, onPage, onPageSize, etiqueta = 'registros' }) {
  if (total === 0) return null
  const paginas = Math.max(1, Math.ceil(total / pageSize))
  const actual = Math.min(page, paginas)
  const desde = (actual - 1) * pageSize
  return (
    <div className="players-pagination">
      <p role="status">{desde + 1}–{Math.min(desde + pageSize, total)} de {total}</p>
      <label className="players-page-size">
        <span>Mostrar</span>
        <select aria-label={`${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} por página`} value={pageSize} onChange={event => onPageSize(Number(event.target.value))}>
          {tamanosPagina.map(size => <option key={size} value={size}>{size}</option>)}
        </select>
        <span>{etiqueta}</span>
      </label>
      <nav aria-label={`Páginas de ${etiqueta}`}>
        <button type="button" className="players-button-secondary" aria-label="Anterior" disabled={actual === 1} onClick={() => onPage(actual - 1)}>‹</button>
        <span>Página {actual} de {paginas}</span>
        <button type="button" className="players-button-secondary" aria-label="Siguiente" disabled={actual === paginas} onClick={() => onPage(actual + 1)}>›</button>
      </nav>
    </div>
  )
}
