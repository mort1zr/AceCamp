import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeCoverage, coverageSummary, findAllowStatements, isLocalEmulator, stripComments } from './checkRulesCoverage.mjs'

const RULES = [
  "service cloud.firestore {",                                  // 1
  "  match /a/{id} {",                                           // 2
  "    // allow write: if comentario;",                          // 3
  "    allow get: if request.auth != null;",                     // 4
  "    allow list, delete: if false;",                           // 5
  "    allow create: if request.resource.data.url.matches('^https://x');", // 6
  "  }",                                                         // 7
  "}",
].join('\n')

// Nodo del informe del emulador: posición de una expresión evaluada (línea y columna desde 1).
const node = (line, column, evaluated = true) => ({
  sourcePosition: { line, column },
  ...(evaluated ? { values: [{ value: { boolValue: true }, count: 1 }] } : {}),
})

describe('cobertura de reglas (PCIT-212)', () => {
  it('ignora los comentarios sin tocar los textos que llevan //', () => {
    const code = stripComments(RULES)
    expect(code).toHaveLength(RULES.length)
    expect(code).not.toContain('comentario')
    expect(code).toContain("'^https://x'")
  })

  it('encuentra cada allow con su línea, operaciones y condición', () => {
    expect(findAllowStatements(RULES).map(({ line, operations, condition }) => ({ line, operations, condition }))).toEqual([
      { line: 4, operations: 'get', condition: 'request.auth != null' },
      { line: 5, operations: 'list, delete', condition: 'false' },
      { line: 6, operations: 'create', condition: "request.resource.data.url.matches('^https://x')" },
    ])
  })

  it('marca como sin pruebas la regla que el emulador nunca evaluó', () => {
    const result = analyzeCoverage({ rules: { files: [{ content: RULES }] }, report: [node(4, 19)] })
    expect(result.statements.map(s => s.status)).toEqual(['probada', 'cerrada', 'sin pruebas'])
    expect(result.untested.map(s => s.line)).toEqual([6])
    expect(coverageSummary(result)).toContain('| 6 | `allow create` | Ninguna prueba la evalúa |')
  })

  it('cuenta las expresiones anidadas dentro de la condición', () => {
    const nested = { ...node(6, 22, false), children: [node(6, 25)] }
    const result = analyzeCoverage({ rules: { files: [{ content: RULES }] }, report: [node(4, 19), nested] })
    expect(result.untested).toEqual([])
  })

  it('una expresión que aparece sin resultados no cuenta como evaluada', () => {
    const result = analyzeCoverage({ rules: { files: [{ content: RULES }] }, report: [node(4, 19), node(6, 22, false)] })
    expect(result.untested.map(s => s.line)).toEqual([6])
  })

  it('no confunde una expresión de otra regla o de una función con esta', () => {
    const result = analyzeCoverage({ rules: { files: [{ content: RULES }] }, report: [node(4, 19), node(6, 18)] })
    expect(result.untested.map(s => s.line)).toEqual([6])
  })

  it('rechaza una regla que permite sin condición', () => {
    const open = RULES.replace('allow get: if request.auth != null;', 'allow get;')
    const result = analyzeCoverage({ rules: { files: [{ content: open }] }, report: [node(6, 22)] })
    expect(result.open.map(s => s.line)).toEqual([4])
    expect(coverageSummary(result)).toContain('Permite sin condición')
  })

  it('encuentra todas las reglas de firestore.rules', () => {
    const rules = readFileSync(new URL('../../firebase/firestore.rules', import.meta.url), 'utf8')
    const statements = findAllowStatements(rules)
    expect(statements.length).toBeGreaterThan(40)
    expect(statements.every(s => s.condition !== null)).toBe(true)
  })

  it('solo pide el informe al emulador local', () => {
    for (const host of ['127.0.0.1:8080', 'localhost:8080', '[::1]:8080']) expect(isLocalEmulator(host), host).toBe(true)
    for (const host of ['example.com:8080', '10.0.0.5:8080', '127.0.0.1', 'localhost:8080/x', 'evil.localhost:80']) {
      expect(isLocalEmulator(host), host).toBe(false)
    }
  })
})
