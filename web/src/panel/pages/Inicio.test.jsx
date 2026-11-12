// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import Inicio from './Inicio.jsx'
import { createDemoInicioService } from '../previews/demoInicioService.js'

afterEach(cleanup)

const montar = (service) =>
  render(
    <MemoryRouter>
      <Inicio service={service} />
    </MemoryRouter>,
  )

describe('Inicio', () => {
  it('muestra el resumen, las listas y el aviso de demostración', async () => {
    montar(createDemoInicioService())
    expect(await screen.findByText('Postulaciones recientes')).toBeTruthy()
    expect(screen.getByText('Modo demostración')).toBeTruthy()
    const resumen = screen.getByRole('region', { name: 'Resumen' })
    expect(within(resumen).getByText('Jugadores en seguimiento')).toBeTruthy()
    expect(within(resumen).getByText('12')).toBeTruthy()
    expect(screen.getByText('Sofía Vargas')).toBeTruthy()
    expect(screen.getByText('Procesando 64%')).toBeTruthy()
    expect(
      screen.getByRole('progressbar', { name: 'Progreso de Diego Salazar vs. T. Ríos' }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Analizar video' }).getAttribute('href')).toBe(
      '/analizar',
    )
  })

  it('muestra listas vacías sin romper la pantalla', async () => {
    montar(
      createDemoInicioService({
        overview: {
          coachName: 'Coach',
          summary: {
            trackedPlayers: 0,
            playersAnalyzedThisWeek: 0,
            analyzedMatchesThisMonth: 0,
            newApplications: 0,
            applicationsInReview: 0,
            processing: 0,
            estimatedMinutes: 0,
            readyToReview: 0,
          },
          applications: [],
          queue: [],
          recentMatches: [],
          alerts: [],
          tracked: [],
        },
      }),
    )
    expect(await screen.findByText('Aún no llegan postulaciones')).toBeTruthy()
    expect(screen.getByText('La cola está libre')).toBeTruthy()
    expect(screen.getByText('Aún no sigues a ningún jugador')).toBeTruthy()
  })

  it('muestra el esqueleto mientras llegan los datos', () => {
    montar({ scopeKey: 'esperando', mode: 'live', subscribe: () => () => {} })
    const esqueleto = screen.getByRole('status')
    expect(esqueleto.getAttribute('aria-busy')).toBe('true')
    expect(within(esqueleto).getByText('Cargando tu resumen…')).toBeTruthy()
    expect(
      screen.queryByText('Todavía no hay actividad. Empieza subiendo el video de un partido.'),
    ).toBeNull()
  })

  it('muestra el error y permite reintentar', async () => {
    const user = userEvent.setup()
    montar(createDemoInicioService({ scenario: 'error' }))
    expect(await screen.findByText('No pudimos cargar tu resumen')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('No pudimos cargar tu resumen')).toBeTruthy()
  })

  it('sin conexión muestra la pantalla vacía, sin métricas ni datos de ejemplo', () => {
    montar(undefined)
    const resumen = screen.getByRole('region', { name: 'Resumen' })
    expect(within(resumen).getAllByText('0')).toHaveLength(4)
    expect(within(resumen).getByText('Registra a tu primer jugador')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ir a Jugadores' }).getAttribute('href')).toBe(
      '/jugadores',
    )
    expect(screen.getByText('Aún no llegan postulaciones')).toBeTruthy()
    expect(screen.getByText('La cola está libre')).toBeTruthy()
    expect(screen.queryByText('Modo demostración')).toBeNull()
    expect(screen.queryByText('Sofía Vargas')).toBeNull()
  })
})
