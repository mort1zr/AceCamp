// Los planes viven en dos lugares: PLANES (web) y firebase/firestore.rules.
// Esta prueba falla si se cambia uno sin el otro (PCIT-41 y PCIT-158).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DIAS_PRUEBA, finDePrueba, PLANES, planVigente, proximaRenovacion, pruebaVencida } from './planes.js'

const reglas = readFileSync(fileURLToPath(new URL('../../../../firebase/firestore.rules', import.meta.url)), 'utf8')

function funcion(nombre) {
  const inicio = reglas.indexOf(`function ${nombre}(`)
  expect(inicio, `falta la función ${nombre} en las reglas`).toBeGreaterThan(-1)
  return reglas.slice(inicio, reglas.indexOf('\n    }', inicio))
}

describe('planes de la web y de las reglas', () => {
  it('withinPlan usa los mismos límites mensuales que PLANES', () => {
    const cuerpo = funcion('withinPlan')
    const mapa = Object.fromEntries(
      [...cuerpo.match(/\{([^}]*)\}\.get\(plan, 0\)/)[1].matchAll(/'(\w+)':\s*(\d+)/g)].map(([, plan, n]) => [plan, Number(n)]),
    )
    const sinTope = [...cuerpo.matchAll(/plan == '(\w+)'/g)].map(([, plan]) => plan)
    const conTope = Object.fromEntries(
      Object.entries(PLANES).filter(([, plan]) => plan.limite > 0).map(([id, plan]) => [id, plan.limite]),
    )

    expect(mapa).toEqual(conTope)
    expect(sinTope).toEqual(Object.keys(PLANES).filter((id) => PLANES[id].limite === null))
    // Sin plan ('free') y cualquier valor desconocido: 0 análisis.
    expect(PLANES.free.limite).toBe(0)
  })

  it('el checkout solo puede guardar planes que existen en PLANES (PCIT-158)', () => {
    const lista = reglas.match(/request\.resource\.data\.plan in \[([^\]]*)\]/)[1]
    const permitidos = [...lista.matchAll(/'(\w+)'/g)].map(([, plan]) => plan)
    expect(permitidos.sort()).toEqual(Object.keys(PLANES).filter((id) => id !== 'free').sort())
  })
})

describe('proximaRenovacion (PCIT-158)', () => {
  const inicio = new Date('2026-11-05T15:00:00Z')

  it('mensual y anual avanzan hasta la próxima fecha futura', () => {
    expect(proximaRenovacion({ plan: 'pro', planSince: inicio, billingCycle: 'mensual' }, new Date('2026-11-20T00:00:00Z')).toISOString())
      .toBe('2026-12-05T15:00:00.000Z')
    expect(proximaRenovacion({ plan: 'pro', planSince: inicio, billingCycle: 'mensual' }, new Date('2027-02-10T00:00:00Z')).toISOString())
      .toBe('2027-03-05T15:00:00.000Z')
    expect(proximaRenovacion({ plan: 'ultra', planSince: inicio, billingCycle: 'anual' }, new Date('2026-12-01T00:00:00Z')).toISOString())
      .toBe('2027-11-05T15:00:00.000Z')
  })

  it('la prueba termina un mes después y no se renueva', () => {
    expect(proximaRenovacion({ plan: 'prueba', planSince: inicio, billingCycle: 'mensual' }, new Date('2027-05-01T00:00:00Z')).toISOString())
      .toBe('2026-12-05T15:00:00.000Z')
  })

  it('sin plan o sin fecha de inicio no hay renovación', () => {
    expect(proximaRenovacion({ plan: 'free', planSince: inicio })).toBeNull()
    expect(proximaRenovacion({ plan: 'pro', planSince: null })).toBeNull()
    expect(proximaRenovacion({ plan: 'inventado', planSince: inicio })).toBeNull()
    expect(proximaRenovacion({ plan: 'pro', planSince: 'no-es-fecha' })).toBeNull()
  })
})

describe('vencimiento de la prueba (PCIT-170)', () => {
  const inicio = new Date('2026-11-05T15:00:00Z')
  const dia = (n) => new Date(inicio.getTime() + n * 24 * 60 * 60 * 1000)

  it('la prueba dura 30 días desde planSince', () => {
    expect(DIAS_PRUEBA).toBe(30)
    expect(finDePrueba(inicio).toISOString()).toBe('2026-12-05T15:00:00.000Z')
    expect(finDePrueba({ toDate: () => inicio }).toISOString()).toBe('2026-12-05T15:00:00.000Z')
    expect(finDePrueba(null)).toBeNull()
  })

  it('vigente hasta el último instante; vencida desde el día 30', () => {
    const org = { plan: 'prueba', planSince: inicio }
    expect(planVigente(org, dia(29))).toBe('prueba')
    expect(planVigente(org, dia(30))).toBe('free')
    expect(pruebaVencida(org, dia(29))).toBe(false)
    expect(pruebaVencida(org, dia(45))).toBe(true)
  })

  it('los demás planes no vencen; sin fecha la prueba sigue; lo desconocido es free', () => {
    expect(planVigente({ plan: 'pro', planSince: inicio }, dia(400))).toBe('pro')
    expect(planVigente({ plan: 'basico', planSince: inicio }, dia(400))).toBe('basico')
    expect(planVigente({ plan: 'prueba' }, dia(400))).toBe('prueba')
    expect(planVigente({ plan: 'inventado' })).toBe('free')
    expect(planVigente(undefined)).toBe('free')
    expect(pruebaVencida({ plan: 'pro', planSince: inicio }, dia(400))).toBe(false)
  })
})
