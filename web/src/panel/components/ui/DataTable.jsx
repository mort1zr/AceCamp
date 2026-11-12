import { useRef, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from './FeedbackStates.jsx'
import './ui.css'

/** Rows come from the page's service; this component never fetches data. */
export function DataTable({
  caption, columns, rows = [], rowKey = 'id', loading = false, error,
  onRetry, emptyTitle = 'Todavía no hay registros', emptyDescription, resizable = false,
}) {
  const [widths, setWidths] = useState(null)
  const headers = useRef({})

  function startResize(event, index) {
    event.preventDefault()
    document.body.style.userSelect = 'none'
    const base = widths ?? columns.map(column => headers.current[column.key]?.offsetWidth ?? 120)
    const startX = event.clientX
    const startWidth = base[index]
    const target = event.currentTarget
    target.setPointerCapture?.(event.pointerId)
    const move = moveEvent => {
      const next = [...base]
      next[index] = Math.max(columns[index].minWidth ?? 70, startWidth + moveEvent.clientX - startX)
      setWidths(next)
    }
    const stop = () => {
      document.body.style.userSelect = ''
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', stop)
      target.removeEventListener('pointercancel', stop)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', stop)
    target.addEventListener('pointercancel', stop)
  }

  if (loading) {
    return <section className="ac-ui ac-table-state" aria-label={caption} aria-busy="true"><LoadingState /></section>
  }
  if (error) {
    return <section className="ac-ui ac-table-state" aria-label={caption}><ErrorState description={typeof error === 'string' ? error : undefined} onRetry={onRetry} /></section>
  }
  if (rows.length === 0) {
    return <section className="ac-ui ac-table-state" aria-label={caption}><EmptyState title={emptyTitle} description={emptyDescription} /></section>
  }

  return (
    <div className="ac-ui ac-table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table
        className={`ac-table${resizable ? ' ac-table--columnas' : ''}`}
        style={widths ? { tableLayout: 'fixed', width: '100%', minWidth: widths.reduce((a, b, i) => a + (i === widths.length - 1 ? 120 : b), 0) } : undefined}
      >
        <caption>{caption}</caption>
        <thead>
          <tr>{columns.map((column, index) => (
            <th
              key={column.key}
              scope="col"
              ref={node => { headers.current[column.key] = node }}
              className={column.align === 'right' ? 'ac-align-right' : undefined}
              style={widths && index < columns.length - 1 ? { width: widths[index] } : undefined}
            >
              {column.label}
              {resizable && index < columns.length - 1 && (
                <span className="ac-table-asa" aria-hidden="true" onPointerDown={event => startResize(event, index)} />
              )}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]}>
              {columns.map(column => <td key={column.key} className={column.align === 'right' ? 'ac-align-right' : undefined}>{column.render ? column.render(row[column.key], row) : (row[column.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
