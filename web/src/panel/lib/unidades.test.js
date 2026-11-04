// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { act, createElement } from 'react'
import DashboardMetrics from '../components/dashboard/DashboardMetrics.jsx'
import { convertirVelocidad, guardarUnidades, leerUnidades } from './unidades.js'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Unidades de velocidad', () => {
  it('convierte km/h a mph solo cuando se elige mph', () => {
    expect(convertirVelocidad(100, 'kmh')).toBe(100)
    expect(convertirVelocidad(100, 'mph')).toBeCloseTo(62.14, 2)
    expect(convertirVelocidad(null, 'mph')).toBeNull()
  })

  it('las métricas del Dashboard cambian al guardar mph', () => {
    render(createElement(DashboardMetrics, { metrics: { averageServeSpeed: 160 } }))
    expect(screen.getByText('km/h')).toBeTruthy()
    act(() => guardarUnidades('mph'))
    expect(leerUnidades()).toBe('mph')
    expect(screen.getByText('mph')).toBeTruthy()
    expect(screen.getByText(/^99[.,]4$/)).toBeTruthy()
  })
})
