// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import BarraSuperior from './BarraSuperior.jsx'

afterEach(cleanup)

function Ubicacion() {
  const { pathname, search } = useLocation()
  return <p data-testid="ubicacion">{pathname + search}</p>
}

const montar = (props) =>
  render(
    <MemoryRouter initialEntries={['/inicio']}>
      <BarraSuperior {...props} />
      <Routes>
        <Route path="*" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>,
  )

describe('Barra superior', () => {
  it('busca jugadores y lleva a la pantalla de Jugadores', async () => {
    const user = userEvent.setup()
    montar()
    await user.type(screen.getByLabelText('Buscar jugador'), 'Valeria{Enter}')
    expect(screen.getByTestId('ubicacion').textContent).toBe('/jugadores?buscar=Valeria')
  })

  it('muestra los avisos vacíos sin indicador de no leídos', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(screen.getByRole('button', { name: 'Notificaciones' }))
    expect(screen.getByRole('dialog', { name: 'Notificaciones' })).toBeTruthy()
    expect(screen.getByText('No tienes avisos')).toBeTruthy()
  })

  it('indica los avisos sin leer y permite marcarlos como leídos', async () => {
    const user = userEvent.setup()
    const onLeerAvisos = vi.fn()
    montar({
      avisos: [{ id: 'a1', titulo: 'Análisis listo', leido: false }],
      onLeerAvisos,
    })
    await user.click(screen.getByRole('button', { name: 'Notificaciones, 1 sin leer' }))
    expect(screen.getByText('Análisis listo')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Marcar como leídas' }))
    expect(onLeerAvisos).toHaveBeenCalledTimes(1)
  })

  it('muestra el usuario y su organización solo al abrir la cuenta', async () => {
    const user = userEvent.setup()
    montar({ usuario: { nombre: 'Rolando Roller', organizacion: 'Universidad' } })
    expect(screen.queryByText('Rolando Roller')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Tu cuenta' }))
    expect(screen.getByText('Rolando Roller')).toBeTruthy()
    expect(screen.getByText('Universidad')).toBeTruthy()
    expect(screen.getAllByText('RR')).toHaveLength(2)
  })
})
