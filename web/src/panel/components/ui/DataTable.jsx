import { EmptyState, ErrorState, LoadingState } from './FeedbackStates.jsx'
import './ui.css'

/** Rows come from the page's service; this component never fetches data. */
export function DataTable({
  caption, columns, rows = [], rowKey = 'id', loading = false, error,
  onRetry, emptyTitle = 'Todavía no hay registros', emptyDescription,
}) {
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
      <table className="ac-table">
        <caption>{caption}</caption>
        <thead>
          <tr>{columns.map(column => <th key={column.key} scope="col" className={column.align === 'right' ? 'ac-align-right' : undefined}>{column.label}</th>)}</tr>
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
