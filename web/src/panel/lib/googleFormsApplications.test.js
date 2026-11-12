import { expect, it } from 'vitest'
import { googleFormApplicationId, readGoogleFormResponses } from './googleFormsApplications.js'

const header = [
  'Marca temporal', 'Nombre completo', 'Fecha de nacimiento', 'Ciudad', 'Dirección de correo electrónico',
  'Año de graduación', 'Autorización', 'Nombre del apoderado', 'Teléfono del apoderado', 'Correo del apoderado',
]
const adult = [46336.52, 'Valentina Demo', 36526, 'Lima', 'demo@example.test', 2027, 'Sí, autorizo']
const minor = [46336.53, 'Otro jugador', '2011-03-04', 'Cusco', 'minor@example.test', 2030, 'Sí, autorizo']

it('lee fechas de Sheets y conserva las respuestas válidas junto a errores por fila', () => {
  const guardian = ['Apoderado Demo', '+51 999111222', 'guardian@example.test']
  const result = readGoogleFormResponses([
    header, adult, [], minor, [...minor, ...guardian], adult.map((value, index) => index === 6 ? 'No' : value),
  ], '2026-11-10')
  expect(result.rows).toMatchObject([
    { number: 2, submittedAt: '46336.52', contact: { birthDate: '2000-01-01', graduationYear: 2027, guardian: null } },
    { number: 5, contact: { guardian: { name: guardian[0], phone: guardian[1], email: guardian[2] } } },
  ])
  expect(result.invalidRows).toEqual([
    { number: 4, message: expect.stringMatching(/apoderado/i) },
    { number: 6, message: expect.stringMatching(/autorización/i) },
  ])
})

it('avisa cuando la pestaña no contiene las columnas de respuestas', () => {
  expect(() => readGoogleFormResponses([['Marca temporal', 'Ciudad']])).toThrow(/faltan columnas/i)
  expect(() => readGoogleFormResponses([[...header, 'Correo de contacto']])).toThrow(/más de una columna/)
  expect(readGoogleFormResponses([])).toEqual({ rows: [], invalidRows: [] })
})

it('usa un ID estable dentro de la organización y la pestaña', async () => {
  const input = {
    orgId: 'org-a', source: { spreadsheetId: 'sheet-a', sheetId: 15 }, submittedAt: '46336.52',
    contact: { email: 'Demo@example.test' },
  }
  const id = await googleFormApplicationId(input)
  expect(id).toMatch(/^[0-9a-f]{64}_gf$/)
  await expect(googleFormApplicationId({ ...input, contact: { email: 'demo@example.test' } })).resolves.toBe(id)
  await expect(googleFormApplicationId({ ...input, orgId: 'org-b' })).resolves.not.toBe(id)
  await expect(googleFormApplicationId({ ...input, submittedAt: '46336.53' })).resolves.not.toBe(id)
})
