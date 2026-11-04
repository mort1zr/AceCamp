// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardEvolution from './DashboardEvolution.jsx'

afterEach(cleanup)
const point = (id, date, speed) => ({ matchId: id, playerId: 'p1', date, opponent: `Rival ${id}`, averageShotSpeed: speed })

describe('Gráfico Recharts de evolución', () => {
  it('ofrece datos accesibles en orden cronológico, incluidos valores ausentes', async () => {
    const { container } = render(<DashboardEvolution playerId="p1" sample evolution={{ playerId: 'p1', points: [point('c', '2026-01-03', 140), point('a', '2026-01-01', 120), point('b', '2026-01-02', null)] }} />)
    expect(screen.getByText('Gráfico de demostración · valores ficticios')).toBeTruthy()
    await userEvent.setup().click(screen.getByText('Ver datos del gráfico'))
    const table = screen.getByRole('table', { name: 'Velocidades de golpe por partido · ejemplos' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map(item => item.textContent)).toEqual(['01/01/2026Rival a120 km/h', '02/01/2026Rival bSin datos', '03/01/2026Rival c140 km/h'])
    // The actual SVG path must contain two disjoint segments, not a bridge over null.
    const path = container.querySelector('.recharts-line-curve')
    expect(path).not.toBeNull()
    expect((path.getAttribute('d').match(/M/g) ?? []).length).toBe(2)
  })

  it('un punto único conserva su medición y no afirma una tendencia', () => {
    render(<DashboardEvolution playerId="p1" evolution={{ playerId: 'p1', points: [point('single', '2026-01-01', 0)] }} />)
    expect(screen.getByText(/Solo hay una medición disponible/)).toBeTruthy()
    expect(screen.getByText('0 km/h')).toBeTruthy()
  })

  it('explica los estados sin esquema, sin fecha válida y sin mediciones', () => {
    const { rerender } = render(<DashboardEvolution playerId="p1" />)
    expect(screen.getByText('La evolución aún no está disponible')).toBeTruthy()
    rerender(<DashboardEvolution playerId="p1" evolution={{ playerId: 'p1', points: [point('invalid', '2026-02-30', 120)] }} />)
    expect(screen.getByText('Aún no hay partidos con fecha válida')).toBeTruthy()
    rerender(<DashboardEvolution playerId="p1" evolution={{ playerId: 'p1', points: [point('missing', '2026-01-01', null)] }} />)
    expect(screen.getByText('Todavía no hay velocidades de golpe disponibles')).toBeTruthy()
    expect(screen.queryByRole('application')).toBeNull()
  })

  it('oculta datos durante carga/error, permite reintentar y rechaza otro jugador', async () => {
    const retry = vi.fn()
    const data = { playerId: 'p1', points: [point('one', '2026-01-01', 120)] }
    const { rerender } = render(<DashboardEvolution playerId="p1" evolution={data} loading />)
    expect(screen.getByText('Cargando evolución…')).toBeTruthy()
    expect(screen.queryByText('120 km/h')).toBeNull()
    rerender(<DashboardEvolution playerId="p1" evolution={data} error="Sin conexión" onRetry={retry} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toContain('Sin conexión')
    rerender(<DashboardEvolution playerId="p2" evolution={data} />)
    expect(screen.getByText('La evolución aún no está disponible')).toBeTruthy()
    expect(screen.queryByText('120 km/h')).toBeNull()
  })
})
