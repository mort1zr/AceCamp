// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ProcessedVideo from './ProcessedVideo.jsx'

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:private-test'), revokeObjectURL: vi.fn() }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('carga un blob privado y lo libera al salir del reporte', async () => {
  const service = { load: vi.fn().mockResolvedValue(new Blob(['video'])) }
  const { unmount } = render(<ProcessedVideo matchId="m1" path="private/path" service={service} />)
  expect(screen.getByRole('status').textContent).toContain('Cargando')
  const video = await screen.findByLabelText('Video procesado del partido')
  expect(video.controls).toBe(true)
  expect(video.src).toBe('blob:private-test')
  fireEvent.error(video)
  expect(screen.getByRole('alert')).toBeTruthy()
  unmount()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-test')
})

it('permite reintentar un fallo de lectura y no expone resultados de una sesión anterior', async () => {
  const service = { load: vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(new Blob(['video'])) }
  const { rerender } = render(<ProcessedVideo matchId="m1" path="private/path" service={service} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar video' }))
  await screen.findByLabelText('Video procesado del partido')
  rerender(<ProcessedVideo matchId="m1" path="private/path" />)
  expect(screen.queryByLabelText('Video procesado del partido')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-test')
})

it('ignora una descarga que termina después de desmontar el reporte', async () => {
  let finish
  const service = { load: () => new Promise(resolve => { finish = resolve }) }
  const { unmount } = render(<ProcessedVideo matchId="m1" path="private/path" service={service} />)
  unmount()
  await act(async () => finish(new Blob(['video'])))
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
