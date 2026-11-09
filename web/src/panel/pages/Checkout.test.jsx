// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../context/AuthContext.js'
import { usePruebaDisponible } from '../hooks/usePruebaDisponible.js'
import Checkout from './Checkout.jsx'

vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }))
vi.mock('../hooks/usePruebaDisponible.js', () => ({ usePruebaDisponible: vi.fn() }))
vi.mock('../../compartido/components/ControlsPill.jsx', () => ({ default: () => null }))
vi.mock('../../compartido/hooks/useAterrizaje.js', () => ({ useAterrizaje: () => ({}) }))
vi.mock('../../compartido/lib/idioma.jsx', () => ({ useIdioma: () => ({ idioma: 'es' }), useTextos: t => t.es }))

beforeEach(() => {
  useAuth.mockReturnValue({ user: { uid: 'u1' }, profile: { orgId: 'org-1' }, loading: false })
  usePruebaDisponible.mockReturnValue(true)
  window.scrollTo = vi.fn()
})
afterEach(cleanup)

function pagar(contratar, url = '/checkout?plan=pro&ciclo=anual') {
  render(<MemoryRouter initialEntries={[url]}><Checkout contratar={contratar} /></MemoryRouter>)
  const anio = String((new Date().getFullYear() + 2) % 100).padStart(2, '0')
  fireEvent.change(document.getElementById('nombre'), { target: { name: 'nombre', value: 'Coach Demo' } })
  fireEvent.change(document.getElementById('numero'), { target: { name: 'numero', value: '4242424242424242' } })
  fireEvent.change(document.getElementById('vencimiento'), { target: { name: 'vencimiento', value: `12${anio}` } })
  fireEvent.change(document.getElementById('cvc'), { target: { name: 'cvc', value: '123' } })
  fireEvent.submit(document.getElementById('checkout-pago'))
}

it('guarda el plan y periodo elegidos y muestra la confirmación', async () => {
  const contratar = vi.fn().mockResolvedValue('pro')
  pagar(contratar)
  expect(await screen.findByText('Tu plan Pro está activo', {}, { timeout: 3000 })).toBeTruthy()
  expect(contratar).toHaveBeenCalledWith({ plan: 'pro', periodo: 'anual' })
})

it('Básico muestra el mes de prueba solo si se guardó como prueba', async () => {
  pagar(vi.fn().mockResolvedValue('basico'), '/checkout?plan=basico')
  expect(await screen.findByText('Ya puedes entrar al panel y empezar a analizar partidos.', {}, { timeout: 3000 })).toBeTruthy()
  cleanup()
  pagar(vi.fn().mockResolvedValue('prueba'), '/checkout?plan=basico')
  expect(await screen.findByText('Tu mes de prueba ya empezó.', {}, { timeout: 3000 })).toBeTruthy()
})

it('si no se puede guardar el plan, avisa y deja reintentar', async () => {
  pagar(vi.fn().mockRejectedValue(new Error('permission-denied')))
  expect((await screen.findByRole('alert', {}, { timeout: 3000 })).textContent).toContain('No pudimos activar el plan')
  expect(screen.queryByText(/está activo/)).toBeNull()
})

it('Básico ofrece la prueba gratis a una organización que todavía no la usó (PCIT-172)', () => {
  render(<MemoryRouter initialEntries={['/checkout?plan=basico']}><Checkout session={{ orgId: 'org-1' }} /></MemoryRouter>)
  expect(usePruebaDisponible).toHaveBeenCalledWith(undefined, 'org-1')
  expect(screen.getAllByText('1 mes de prueba gratis').length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: /Empezar prueba gratis/ })).toBeTruthy()
})

it('Básico se cobra sin prueba si la organización ya contrató antes (PCIT-172)', () => {
  usePruebaDisponible.mockReturnValue(false)
  render(<MemoryRouter initialEntries={['/checkout?plan=basico']}><Checkout session={{ orgId: 'org-1' }} /></MemoryRouter>)
  expect(screen.queryByText('1 mes de prueba gratis')).toBeNull()
  expect(screen.queryByRole('button', { name: /Empezar prueba gratis/ })).toBeNull()
  expect(screen.getByRole('button', { name: /Pagar y activar/ })).toBeTruthy()
})
