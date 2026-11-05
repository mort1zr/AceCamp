import { beforeEach, describe, expect, it, vi } from 'vitest'

const transaccion = { get: vi.fn(), update: vi.fn() }
vi.mock('firebase/firestore', () => ({
  doc: (db, ...ruta) => ({ path: ruta.join('/') }),
  serverTimestamp: () => 'SERVER_TIME',
  runTransaction: async (db, fn) => fn(transaccion),
}))

const { contratarPlan, planAGuardar } = await import('./contratarPlan.js')

const org = (data) => ({ exists: () => data != null, data: () => data })

describe('planAGuardar', () => {
  it('Básico es prueba la primera vez y Básico normal después', () => {
    expect(planAGuardar('basico', { plan: 'free' })).toBe('prueba')
    expect(planAGuardar('basico', { plan: 'pro', planSince: new Date() })).toBe('basico')
  })

  it('Pro y Ultra se guardan tal cual; un plan desconocido falla', () => {
    expect(planAGuardar('pro')).toBe('pro')
    expect(planAGuardar('ultra')).toBe('ultra')
    expect(() => planAGuardar('free')).toThrow()
  })
})

describe('contratarPlan', () => {
  beforeEach(() => {
    transaccion.get.mockReset()
    transaccion.update.mockReset()
  })

  it('guarda solo plan, periodo y fecha en la organización', async () => {
    transaccion.get.mockResolvedValue(org({ plan: 'free', ownerId: 'u1' }))
    await expect(contratarPlan({ db: {}, orgId: 'org-1', plan: 'basico', periodo: 'anual' })).resolves.toBe('prueba')
    expect(transaccion.update).toHaveBeenCalledWith(
      { path: 'orgs/org-1' },
      { plan: 'prueba', billingCycle: 'anual', planSince: 'SERVER_TIME' },
    )
  })

  it('rechaza datos inválidos sin escribir', async () => {
    await expect(contratarPlan({ db: {}, orgId: null, plan: 'pro', periodo: 'mensual' })).rejects.toThrow()
    await expect(contratarPlan({ db: {}, orgId: 'o', plan: 'pro', periodo: 'semanal' })).rejects.toThrow()
    await expect(contratarPlan({ db: {}, orgId: 'o', plan: 'gratis', periodo: 'mensual' })).rejects.toThrow()
    transaccion.get.mockResolvedValue(org(null))
    await expect(contratarPlan({ db: {}, orgId: 'o', plan: 'pro', periodo: 'mensual' })).rejects.toThrow()
    expect(transaccion.update).not.toHaveBeenCalled()
  })
})
