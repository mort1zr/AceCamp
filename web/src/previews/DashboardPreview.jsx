import { useMemo, useState } from 'react'
import Dashboard from '../pages/Dashboard.jsx'
import { SegmentedControl } from '../components/ui'
import { createDemoPlayersService } from './demoPlayersService.js'
import { createDemoDashboardService } from './demoDashboardService.js'

export default function DashboardPreview() {
  const [theme, setTheme] = useState('dark')
  const [scenario, setScenario] = useState('data')
  const [playersService] = useState(() => createDemoPlayersService())
  const overviewService = useMemo(() => createDemoDashboardService({ scopeKey: playersService.scopeKey, scenario }), [playersService, scenario])

  return <div className="players-preview" data-theme={theme}><header className="players-preview-bar"><span className="players-preview-brand">AceCam<span> / Dashboard</span></span><SegmentedControl label="Apariencia" value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} /></header><main className="players-preview-content"><div className="dashboard-preview-tools"><SegmentedControl label="Escenario de demostración" value={scenario} onChange={setScenario} options={[{ value: 'data', label: 'Con datos' }, { value: 'loading', label: 'Cargando' }, { value: 'empty', label: 'Sin datos' }, { value: 'unmapped', label: 'Sin indicadores' }, { value: 'error', label: 'Error' }]} /></div><Dashboard playersService={playersService} overviewService={overviewService} /></main></div>
}
