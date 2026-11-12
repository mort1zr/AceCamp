import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MATRIX, ROLES } from '../tests/rules/accessMatrix.js'
import { DOC_PATH, accessMatrixTable, replaceSection } from './accessMatrixTable.mjs'

describe('matriz de acceso (PCIT-210)', () => {
  it('cada fila tiene un id único, motivo y solo roles conocidos', () => {
    const ids = MATRIX.map(row => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const row of MATRIX) {
      expect(row.motivo.length, row.id).toBeGreaterThan(10)
      expect(['leer', 'listar', 'crear', 'editar', 'borrar']).toContain(row.operacion)
      for (const role of row.permitido) expect(Object.keys(ROLES), row.id).toContain(role)
    }
  })

  it('la tabla marca con ✅ solo los roles permitidos', () => {
    const table = accessMatrixTable([{ recurso: 'x', operacion: 'leer', permitido: ['admin'], motivo: 'Prueba' }], ['admin', 'visitante'])
    expect(table.split('\n').at(-1)).toBe('| `x` | leer | ✅ | ❌ | Prueba |')
  })

  it('el documento de PCIT-67 muestra la matriz actual', () => {
    const text = readFileSync(DOC_PATH, 'utf8')
    expect(replaceSection(text, accessMatrixTable()), 'Ejecuta: node scripts/accessMatrixTable.mjs --write').toBe(text)
  })
})
