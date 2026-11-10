// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

const escuchas = []
vi.mock('firebase/firestore', () => ({
  doc: (db, ...ruta) => ruta.join('/'),
  onSnapshot: (ref, ok, error) => { escuchas.push({ ref, ok, error }); return vi.fn() },
}))

const { usePruebaDisponible } = await import('./usePruebaDisponible.js')
const org = (datos) => ({ data: () => datos })

beforeEach(() => { escuchas.length = 0 })

it('sin sesión no lee nada y no sabe (null)', () => {
  const { result } = renderHook(() => usePruebaDisponible({}, undefined))
  expect(result.current).toBeNull()
  expect(escuchas).toHaveLength(0)
})

it('disponible solo si la organización nunca contrató (sin planSince)', () => {
  const { result } = renderHook(() => usePruebaDisponible({}, 'org-1'))
  expect(escuchas[0].ref).toBe('orgs/org-1')
  act(() => escuchas[0].ok(org({ plan: 'free' })))
  expect(result.current).toBe(true)
  act(() => escuchas[0].ok(org({ plan: 'free', planSince: new Date() })))
  expect(result.current).toBe(false)
  act(() => escuchas[0].error(new Error('permission-denied')))
  expect(result.current).toBeNull()
})
