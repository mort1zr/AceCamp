// Tabla de la matriz de acceso (PCIT-210) para docs/PCIT-67-seguridad-de-datos.md.
//   node scripts/accessMatrixTable.mjs           muestra la tabla
//   node scripts/accessMatrixTable.mjs --write   la actualiza en el documento
// accessMatrixTable.test.js falla si el documento y la matriz no coinciden.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MATRIX, ROLES, expected } from '../tests/rules/accessMatrix.js'

export const DOC_PATH = fileURLToPath(new URL('../../docs/PCIT-67-seguridad-de-datos.md', import.meta.url))
export const START = '<!-- matriz:inicio (generada con node scripts/accessMatrixTable.mjs --write) -->'
export const END = '<!-- matriz:fin -->'

const HEADERS = {
  visitante: 'Visitante', sinOrganizacion: 'Sin club', entrenador: 'Entrenador', otroEntrenador: 'Otro entrenador',
  admin: 'Admin', entrenadorAjeno: 'Entrenador club B', adminAjeno: 'Admin club B', plataforma: 'Plataforma',
}

export function accessMatrixTable(matrix = MATRIX, roles = Object.keys(ROLES)) {
  const head = ['Recurso', 'Operación', ...roles.map(role => HEADERS[role] ?? role), 'Motivo']
  const lines = [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`]
  for (const row of matrix) {
    const cells = roles.map(role => (expected(row, role) ? '✅' : '❌'))
    lines.push(`| \`${row.recurso}\` | ${row.operacion} | ${cells.join(' | ')} | ${row.motivo} |`)
  }
  return lines.join('\n')
}

export function replaceSection(text, table) {
  const start = text.indexOf(START)
  const end = text.indexOf(END)
  if (start < 0 || end < start) throw new Error(`Faltan los marcadores de la matriz en ${DOC_PATH}`)
  return `${text.slice(0, start + START.length)}\n\n${table}\n\n${text.slice(end)}`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const table = accessMatrixTable()
  if (process.argv.includes('--write')) writeFileSync(DOC_PATH, replaceSection(readFileSync(DOC_PATH, 'utf8'), table))
  else console.log(table)
}
