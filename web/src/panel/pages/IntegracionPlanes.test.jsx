// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuth } from '../context/AuthContext.js'
import { incluyeSeccion, usePlanVista } from '../context/PlanVistaContext.js'
import PlanVistaProvider from '../context/PlanVistaProvider.jsx'
import { PLANES } from '../lib/services/firestoreConfiguracionService.js'
import Checkout from './Checkout.jsx'
import Login from './Login.jsx'
import Registro from './Registro.jsx'

vi.mock('../context/AuthContext.js', () => ({ useAuth: vi.fn() }))
vi.mock('../../compartido/components/ControlsPill.jsx', () => ({ default: () => null }))
vi.mock('../../compartido/hooks/useAterrizaje.js', () => ({ useAterrizaje: () => ({}) }))
vi.mock('../../compartido/lib/idioma.jsx', () => ({ useIdioma: () => ({ idioma: 'es' }), useTextos: t => t.es }))

beforeEach(() => { localStorage.clear(); useAuth.mockReturnValue({ user: { uid: 'u1' }, profile: {}, loading: false }) })
afterEach(cleanup)

function Destination() {
  const location = useLocation()
  return <output>{JSON.stringify({ path: location.pathname, search: location.search, from: location.state?.from })}</output>
}

it('checkout exige sesión y conserva plan/ciclo al dirigir al registro', async () => {
  useAuth.mockReturnValue({ user: null, loading: false })
  render(<MemoryRouter initialEntries={['/checkout?plan=ultra&ciclo=anual']}><Routes>
    <Route path="/checkout" element={<Checkout />} /><Route path="/registro" element={<Destination />} />
  </Routes></MemoryRouter>)
  expect((await screen.findByRole('status')).textContent).toContain('plan=ultra&ciclo=anual')
})

it.each([['login', Login], ['registro', Registro]])('%s devuelve al checkout conservando el plan elegido', async (path, Page) => {
  render(<MemoryRouter initialEntries={[{ pathname: `/${path}`, state: { from: { pathname: '/checkout', search: '?plan=pro&ciclo=anual' } } }]}><Routes>
    <Route path={`/${path}`} element={<Page />} /><Route path="/checkout" element={<Destination />} />
  </Routes></MemoryRouter>)
  const output = JSON.parse((await screen.findByRole('status')).textContent)
  expect(output).toMatchObject({ path: '/checkout', search: '?plan=pro&ciclo=anual' })
})

function Plan() {
  const { plan } = usePlanVista()
  return <output>{plan}</output>
}

it('free bloquea el panel pero permite configuración; planes existentes mantienen sus secciones', () => {
  expect(PLANES.free.id).toBe('ninguno')
  for (const section of ['inicio', 'dashboard', 'jugadores', 'analizar', 'partidos', 'comparador']) expect(incluyeSeccion('ninguno', section)).toBe(false)
  expect(incluyeSeccion('ninguno', 'configuracion')).toBe(true)
  expect(incluyeSeccion('pro', 'dashboard')).toBe(true)
  expect(incluyeSeccion('pro', 'partidos')).toBe(true)
})

it('la vista de plan está aislada por cuenta y no convierte una simulación en plan de otra cuenta', () => {
  localStorage.setItem('acecam-plan-vista:u1', 'ultra')
  const { rerender } = render(<PlanVistaProvider key="u1" cuenta="u1" planReal={PLANES.free}><Plan /></PlanVistaProvider>)
  expect(screen.getByRole('status').textContent).toBe('ultra')
  rerender(<PlanVistaProvider key="u2" cuenta="u2" planReal={PLANES.free}><Plan /></PlanVistaProvider>)
  expect(screen.getByRole('status').textContent).toBe('ninguno')
})
