// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TarjetaEstadistica, TarjetasEstadisticas } from './TarjetaEstadistica.jsx'

afterEach(cleanup)

describe('Tarjetas de estadísticas', () => {
  it('presenta cada grupo con su cifra y la comparación disponible', () => {
    render(<TarjetasEstadisticas cards={[
      { id: 'saque', label: 'Velocidad de saque', value: 128.5, unit: 'km/h', comparison: '+5 % frente al partido anterior' },
      { id: 'golpes', label: 'Velocidad de golpe', value: 82, unit: 'km/h' },
      { id: 'desplazamiento', label: 'Desplazamiento', value: 300, unit: 'm' },
      { id: 'peloteos', label: 'Peloteos largos', value: 0 },
    ]} />)

    const [saque, golpes, desplazamiento, peloteos] = screen.getAllByRole('article')
    expect(within(saque).getByRole('heading').textContent).toBe('Velocidad de saque')
    expect(saque.textContent).toContain(`${new Intl.NumberFormat('es-PE').format(128.5)} km/h`)
    expect(within(saque).getByText('+5 % frente al partido anterior')).toBeTruthy()
    expect(golpes.textContent).toContain('82 km/h')
    expect(desplazamiento.textContent).toContain('300 m')
    expect(within(peloteos).getByText('0')).toBeTruthy()
  })

  it.each([undefined, null, '', NaN, Infinity])('muestra Sin datos para una medida ausente o inválida (%s)', value => {
    render(<TarjetaEstadistica label="Saque" value={value} unit="km/h" comparison="+5 %" />)

    const card = screen.getByRole('article')
    expect(within(card).getByText('Sin datos')).toBeTruthy()
    expect(within(card).queryByText('km/h')).toBeNull()
    expect(within(card).queryByText('+5 %')).toBeNull()
  })
})
