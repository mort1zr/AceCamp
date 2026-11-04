import { useState } from 'react'
import Analizar from '../pages/Analizar.jsx'
import { SegmentedControl } from '../components/ui'
import { createDemoPlayersService } from './demoPlayersService.js'
import { createDemoAnalysisService } from './demoAnalysisService.js'

export default function AnalysisPreview() {
  const [theme, setTheme] = useState('dark')
  const [services] = useState(() => {
    const playersService = createDemoPlayersService()
    return { playersService, service: createDemoAnalysisService({ playersService }) }
  })
  return <div className="players-preview" data-theme={theme}><header className="players-preview-bar"><span className="players-preview-brand">AceCam<span> / Analizar video</span></span><SegmentedControl label="Apariencia" value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} /></header><main className="players-preview-content"><Analizar {...services} /></main></div>
}
