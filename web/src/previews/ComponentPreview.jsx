import { useState } from 'react'
import { DataTable, EmptyState, ErrorState, KpiCard, LoadingState, SegmentedControl, StatusBadge } from '../components/ui'

// Fixtures belong to this development preview, never to a production metric.
const rows = [
  { id: 'demo-1', player: 'Jugador de ejemplo A', matches: 4, status: 'listo' },
  { id: 'demo-2', player: 'Jugador de ejemplo B', matches: 0, status: 'procesando' },
  { id: 'demo-3', player: 'Jugador de ejemplo C', matches: null, status: 'en cola' },
]
const columns = [
  { key: 'player', label: 'Jugador' },
  { key: 'matches', label: 'Partidos', align: 'right' },
  { key: 'status', label: 'Estado', render: status => <StatusBadge status={status} /> },
]
const viewOptions = [
  { value: 'data', label: 'Con datos' },
  { value: 'loading', label: 'Cargando' },
  { value: 'empty', label: 'Vacío' },
  { value: 'error', label: 'Error' },
]

export default function ComponentPreview() {
  const [theme, setTheme] = useState('dark')
  const [view, setView] = useState('data')
  const [notice, setNotice] = useState('')

  return (
    <main className="ac-preview" data-theme={theme}>
      <div className="ac-preview__content">
        <header className="ac-preview__header">
          <div><p className="ac-preview__eyebrow">AceCam · Biblioteca de interfaz</p><h1>Una base para cada pantalla.</h1><p>Ejemplos de desarrollo. Los valores de esta página son ficticios.</p></div>
          <SegmentedControl label="Apariencia" value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} />
        </header>

        <section aria-labelledby="kpi-heading">
          <h2 id="kpi-heading">Indicadores</h2>
          <div className="ac-preview__grid">
            <KpiCard label="Velocidad de saque · ejemplo" value="128.5" unit="km/h" trend="+5.2 % frente al periodo anterior" trendTone="positive" description="Promedio del periodo seleccionado" />
            <KpiCard label="Dobles faltas · ejemplo" value={0} trend="2 menos que el periodo anterior" trendTone="positive" />
            <KpiCard label="Peloteos" value={null} description="Sin datos disponibles" />
          </div>
        </section>

        <section aria-labelledby="badge-heading">
          <h2 id="badge-heading">Estados</h2>
          <div className="ac-preview__badges">{['en cola', 'procesando', 'listo', 'error', 'nueva', 'en revisión', 'analizada', 'contactada', 'descartada', 'Desconocido'].map(status => <StatusBadge key={status} status={status} />)}</div>
        </section>

        <section aria-labelledby="table-heading">
          <h2 id="table-heading">Tabla de registros</h2>
          <SegmentedControl label="Estado de la tabla" options={viewOptions} value={view} onChange={setView} />
          <div className="ac-preview__table">
            <DataTable caption="Jugadores · datos de ejemplo" columns={columns} rows={view === 'empty' ? [] : rows} loading={view === 'loading'} error={view === 'error' ? 'Error de ejemplo. Puedes probar el botón de reintento.' : null} onRetry={() => setView('data')} emptyTitle="Todavía no hay jugadores" emptyDescription="Los jugadores que registres aparecerán aquí." />
          </div>
        </section>

        <section aria-labelledby="feedback-heading">
          <h2 id="feedback-heading">Mensajes y acciones</h2>
          <div className="ac-preview__grid">
            <div className="ac-preview__panel"><LoadingState title="Procesando el video…" description="Las estadísticas aparecerán cuando el análisis termine." /></div>
            <div className="ac-preview__panel"><EmptyState title="Aún no hay partidos" description="Sube un video para comenzar." actionLabel="Probar acción" onAction={() => setNotice('Acción de ejemplo ejecutada.')} /></div>
            <div className="ac-preview__panel"><ErrorState description="No se pudo completar la consulta de ejemplo." onRetry={() => setNotice('Reintento de ejemplo ejecutado.')} /></div>
          </div>
          <p role="status">{notice}</p>
        </section>
      </div>
    </main>
  )
}
