import { useMemo, useState } from 'react'
import { MemoryRouter } from 'react-router'
import Inicio from '../pages/Inicio.jsx'
import { SegmentedControl } from '../components/ui'
import { createDemoInicioService } from './demoInicioService.js'

export default function InicioPreview() {
  const [theme, setTheme] = useState('dark')
  const [scenario, setScenario] = useState('data')
  const service = useMemo(
    () => (scenario === 'none' ? undefined : createDemoInicioService({ scenario })),
    [scenario],
  )

  return (
    <div data-theme={theme} className="min-h-dvh bg-bg text-text">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5">
        <span className="text-2xl font-semibold">
          AceCam<span className="ml-2 text-sm font-normal text-muted">/ Inicio</span>
        </span>
        <div className="flex flex-wrap gap-4">
          <SegmentedControl
            label="Escenario de demostración"
            value={scenario}
            onChange={setScenario}
            options={[
              { value: 'data', label: 'Con datos' },
              { value: 'none', label: 'Sin conexión' },
              { value: 'loading', label: 'Cargando' },
              { value: 'error', label: 'Error' },
            ]}
          />
          <SegmentedControl
            label="Apariencia"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Oscuro' },
              { value: 'light', label: 'Claro' },
            ]}
          />
        </div>
      </header>
      <main className="px-6 py-8">
        <MemoryRouter>
          <Inicio service={service} />
        </MemoryRouter>
      </main>
    </div>
  )
}
