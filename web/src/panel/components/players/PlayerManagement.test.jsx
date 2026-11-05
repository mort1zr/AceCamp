// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import PlayerProfile from './PlayerProfile.jsx'

afterEach(cleanup)
const player = { id: 'p1', orgId: 'org-a', createdBy: 'coach', fullName: 'Jugador de prueba', birthDate: '2010-01-01', utr: 10,
  guardian: { name: 'Apoderado de prueba', phone: '999999999', email: 'guardian@example.test' } }
const service = () => ({ mode: 'live', canViewProfile: () => true, subscribeAnalyzedMatches: (_p, receive) => { receive([]); return () => {} }, update: vi.fn(), remove: vi.fn() })

it('muestra el apoderado, valida la edición y conserva el borrador cuando falla el guardado', async () => {
  const api = service()
  api.update.mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce(player)
  const user = userEvent.setup()
  render(<PlayerProfile player={player} service={api} onBack={() => {}} />)
  expect(screen.getByText('guardian@example.test')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Editar jugador' }))
  const name = screen.getByLabelText('Nombre completo *')
  await user.clear(name)
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(api.update).not.toHaveBeenCalled()
  await user.type(name, 'Nombre nuevo')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(name.value).toBe('Nombre nuevo')
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByRole('button', { name: 'Editar jugador' })).toBeTruthy()
  expect(api.update).toHaveBeenCalledTimes(2)
  expect(api.update.mock.calls[1][0]).toBe(player)
  expect(api.update.mock.calls[1][1]).toMatchObject({ fullName: 'Nombre nuevo', guardianEmail: 'guardian@example.test' })
})

it('pide confirmación antes de retirar al jugador, permite cancelar y reintentar un fallo', async () => {
  const api = service()
  api.remove.mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce()
  const back = vi.fn()
  const user = userEvent.setup()
  render(<PlayerProfile player={player} service={api} onBack={back} />)
  const open = () => user.click(screen.getByRole('button', { name: 'Eliminar de la plantilla' }))
  await open()
  const dialog = () => within(screen.getByRole('alertdialog'))
  expect(api.remove).not.toHaveBeenCalled()
  expect(dialog().getByText(/Sus partidos, videos, datos y notas se conservarán/)).toBeTruthy()
  expect(document.activeElement).toBe(dialog().getByRole('button', { name: 'Cancelar' }))
  await user.click(dialog().getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Eliminar de la plantilla' }))
  await open()
  await user.click(dialog().getByRole('button', { name: 'Confirmar eliminación' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  await user.click(dialog().getByRole('button', { name: 'Confirmar eliminación' }))
  expect(back).toHaveBeenCalledTimes(1)
  expect(api.remove).toHaveBeenCalledTimes(2)
})
