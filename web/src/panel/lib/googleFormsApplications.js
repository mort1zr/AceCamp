import { normalizeApplicationContact } from './publicApplications.js'

const fields = {
  submittedAt: ['marca temporal', 'timestamp'],
  fullName: ['nombre completo'],
  birthDate: ['fecha de nacimiento'],
  city: ['ciudad'],
  email: ['correo de contacto', 'direccion de correo electronico', 'email address'],
  graduationYear: ['ano de graduacion'],
  consentAccepted: ['autorizacion'],
  academy: ['academia', 'academia (opcional)'],
  message: ['mensaje', 'mensaje (opcional)'],
  guardianName: ['nombre del apoderado'],
  guardianPhone: ['telefono del apoderado'],
  guardianEmail: ['correo del apoderado'],
}
const required = ['submittedAt', 'fullName', 'birthDate', 'city', 'email', 'graduationYear', 'consentAccepted']
const key = value => String(value ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const googleEpoch = Date.UTC(1899, 11, 30)

function birthDate(value) {
  if (typeof value !== 'number') return String(value ?? '').trim()
  const date = new Date(googleEpoch + value * 86_400_000)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : ''
}

export function readGoogleFormResponses(values, today) {
  if (values.length === 0) return { rows: [], invalidRows: [] }
  const [header, ...responses] = values
  const titles = header.map(key)
  const positions = Object.fromEntries(Object.entries(fields).map(([field, aliases]) => {
    const matches = titles.flatMap((title, index) => aliases.includes(title) ? [index] : [])
    if (matches.length > 1) throw new Error(`La pestaña tiene más de una columna para «${aliases[0]}».`)
    return [field, matches[0]]
  }))
  const missing = required.filter(field => positions[field] == null).map(field => fields[field][0])
  if (missing.length) throw new Error(`Faltan columnas en la pestaña: ${missing.join(', ')}.`)

  const rows = []
  const invalidRows = []
  responses.forEach((cells, index) => {
    if (!cells.some(cell => String(cell ?? '').trim())) return
    const cell = field => cells[positions[field]]
    const text = field => String(cell(field) ?? '').trim()
    const submittedAt = text('submittedAt')
    const input = {
      ...Object.fromEntries(Object.keys(fields).map(field => [field, text(field)])),
      birthDate: birthDate(cell('birthDate')),
      consentAccepted: key(cell('consentAccepted')) === 'si, autorizo',
    }
    const number = index + 2
    try {
      if (!submittedAt) throw new Error('Falta la marca temporal.')
      rows.push({ number, submittedAt, contact: normalizeApplicationContact(input, today) })
    } catch (error) {
      invalidRows.push({ number, message: Object.values(error.fields ?? {}).join(' ') || error.message })
    }
  })
  return { rows, invalidRows }
}

export async function googleFormApplicationId({ orgId, source, submittedAt, contact }) {
  // La marca temporal y el correo identifican la respuesta dentro de su pestaña.
  const identity = JSON.stringify([orgId, source.spreadsheetId, source.sheetId, submittedAt, contact.email.toLowerCase()])
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') + '_gf'
}
