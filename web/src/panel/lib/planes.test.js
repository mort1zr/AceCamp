// Los planes viven en dos lugares: PLANES (web) y firebase/firestore.rules.
// Esta prueba falla si se cambia uno sin el otro (PCIT-41 y PCIT-158).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PLANES } from './planes.js'

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
