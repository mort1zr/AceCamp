// Cobertura de las reglas de Firestore como puerta de la CI (PCIT-212, parte de PCIT-67).
//
// Después de la matriz de acceso (PCIT-211), el emulador de Firestore sabe qué expresiones
// evaluó. Este script descarga ese informe y comprueba que cada `allow` de firestore.rules
// se evaluó al menos una vez. Falla si alguna regla no la prueba la matriz, o si alguna
// permite sin condición. `allow …: if false` cuenta como cerrada: no necesita pruebas.
//
//   node scripts/checkRulesCoverage.mjs [--out carpeta]
//
// Lo ejecuta `npm run test:rules` dentro de los emuladores, justo después de la matriz.

import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RULES_FILE = 'firebase/firestore.rules'

// Cambia los comentarios por espacios, sin mover ningún carácter ni tocar los textos.
export function stripComments(source) {
  let out = ''
  let quote = null
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quote) {
      out += char
      if (char === '\\') out += source[++i] ?? ''
      else if (char === quote) quote = null
    } else if (char === "'" || char === '"') {
      quote = char
      out += char
    } else if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') { out += ' '; i++ }
      if (i < source.length) out += '\n'
    } else {
      out += char
    }
  }
  return out
}

// Cada `allow <operaciones>[: if <condición>];` con la posición de su condición.
export function findAllowStatements(source) {
  const code = stripComments(source)
  const statements = []
  for (const match of code.matchAll(/\ballow\s+([a-z,\s]+?)\s*(?::\s*if\b([\s\S]*?))?;/g)) {
    const raw = match[2]
    const condition = raw?.trim() ?? null
    // Posición del primer carácter de la condición, sin los espacios tras `if`.
    const start = raw == null ? match.index
      : match.index + match[0].lastIndexOf(raw) + (raw.length - raw.trimStart().length)
    statements.push({
      line: code.slice(0, match.index).split('\n').length,
      operations: match[1].replace(/\s+/g, ' ').trim(),
      condition,
      start,
      end: raw == null ? match.index + match[0].length : start + condition.length,
    })
  }
  return statements
}

function lineStarts(source) {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

// Posición de cada expresión que el emulador evaluó. El informe incluye todas las
// expresiones de las reglas, pero solo las evaluadas traen resultados (`values`).
// El emulador vacía los resultados cada vez que se cargan las reglas: por eso
// `npm run test:rules` mide la cobertura justo después de la matriz de acceso.
function evaluatedOffsets(report, source) {
  const starts = lineStarts(source)
  const offsets = []
  const walk = node => {
    const { line, column } = node.sourcePosition ?? {}
    if (line && column && node.values?.length) offsets.push(starts[line - 1] + column - 1)
    for (const child of node.children ?? []) walk(child)
  }
  for (const node of report ?? []) walk(node)
  return offsets
}

export function analyzeCoverage(coverage) {
  const source = coverage?.rules?.files?.[0]?.content
  if (typeof source !== 'string') throw new Error('El informe de cobertura no incluye las reglas.')
  const offsets = evaluatedOffsets(coverage.report, source)
  const statements = findAllowStatements(source).map(statement => {
    if (statement.condition === null || statement.condition === 'true') return { ...statement, status: 'abierta' }
    if (statement.condition === 'false') return { ...statement, status: 'cerrada' }
    const tested = offsets.some(offset => offset >= statement.start && offset < statement.end)
    return { ...statement, status: tested ? 'probada' : 'sin pruebas' }
  })
  return {
    statements,
    untested: statements.filter(s => s.status === 'sin pruebas'),
    open: statements.filter(s => s.status === 'abierta'),
  }
}

export function coverageSummary({ statements, untested, open }) {
  const tested = statements.filter(s => s.status === 'probada').length
  const closed = statements.filter(s => s.status === 'cerrada').length
  const lines = [
    '### Cobertura de las reglas de Firestore',
    '',
    `**${tested}** reglas \`allow\` probadas, **${closed}** cerradas (\`if false\`), `
      + `**${untested.length}** sin pruebas y **${open.length}** sin condición.`,
    '',
  ]
  const problems = [...open, ...untested]
  if (problems.length) {
    lines.push('| Línea | Regla | Problema |', '| --- | --- | --- |')
    for (const s of problems) {
      lines.push(`| ${s.line} | \`allow ${s.operations}\` | ${s.status === 'abierta' ? 'Permite sin condición' : 'Ninguna prueba la evalúa'} |`)
    }
  }
  return lines.join('\n')
}

async function main() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
  const project = process.env.ACECAM_RULES_PROJECT || 'demo-acecam'
  const base = `http://${host}/emulator/v1/projects/${project}:ruleCoverage`
  const outIndex = process.argv.indexOf('--out')
  const out = outIndex > 0 ? process.argv[outIndex + 1] : null

  const response = await fetch(base)
  if (!response.ok) throw new Error(`El emulador no devolvió la cobertura (${response.status}).`)
  const result = analyzeCoverage(await response.json())
  const summary = coverageSummary(result)
  console.log(summary)

  if (out) {
    mkdirSync(out, { recursive: true })
    writeFileSync(join(out, 'resumen.md'), `${summary}\n`)
    const html = await fetch(`${base}.html`)
    if (html.ok) writeFileSync(join(out, 'cobertura.html'), Buffer.from(await html.arrayBuffer()))
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)

  for (const s of result.open) {
    console.log(`::error file=${RULES_FILE},line=${s.line}::allow ${s.operations} permite sin condición.`)
  }
  for (const s of result.untested) {
    console.log(`::error file=${RULES_FILE},line=${s.line}::allow ${s.operations} no se evalúa en ninguna prueba de reglas.`)
  }
  if (result.open.length || result.untested.length) process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`::error::${error.message}`)
    process.exit(1)
  })
}
