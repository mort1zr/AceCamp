// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dashboard from './Dashboard.jsx'
import { buildDashboardOverview } from '../lib/dashboardOverview.js'
import { createDemoPlayersService } from '../previews/demoPlayersService.js'

afterEach(cleanup)

it('avisa de resultados incompatibles y no los convierte en estadísticas de saque', async () => {
  const playersService = createDemoPlayersService()
  const overviewService = {
    scopeKey: playersService.scopeKey, mode: 'demo',
    subscribePlayer(playerId, receive) {
      receive(buildDashboardOverview([{ id: 'legacy', orgId: 'demo-org', playerId, status: 'listo', statistics: { player_1_average_shot_speed: 160 } }], { orgId: 'demo-org', playerId, decodeStatistics: row => row.statistics }))
      return () => {}
    },
  }
  render(<Dashboard playersService={playersService} overviewService={overviewService} />)
  await screen.findByRole('option', { name: 'Valeria Torres' })
  await userEvent.setup().selectOptions(screen.getByLabelText('Jugador'), 'example-1')
  expect(await screen.findByText('Algunos análisis terminados aún no tienen indicadores disponibles. El resumen incluye únicamente los resultados verificables.')).toBeTruthy()
  expect(screen.getByText('Todavía no hay estadísticas para este jugador')).toBeTruthy()
  expect(screen.queryByText('160')).toBeNull()
  expect(screen.getAllByText('Sin datos')).toHaveLength(3)
})
