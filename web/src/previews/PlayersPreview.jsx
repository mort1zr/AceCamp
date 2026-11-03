import { useState } from 'react'
import Jugadores from '../pages/Jugadores.jsx'
import { SegmentedControl } from '../components/ui'
import { createDemoPlayersService } from './demoPlayersService.js'

export default function PlayersPreview() {
  const [theme, setTheme] = useState('dark')
  const [service] = useState(() => createDemoPlayersService())
  return (
    <div className="players-preview" data-theme={theme}>
      <header className="players-preview-bar"><span className="players-preview-brand">AceCam<span> / Jugadores</span></span><SegmentedControl label="Apariencia" value={theme} onChange={setTheme} options={[{ value: 'dark', label: 'Oscuro' }, { value: 'light', label: 'Claro' }]} /></header>
      <main className="players-preview-content"><Jugadores service={service} /></main>
    </div>
  )
}
