import { beforeEach, describe, expect, it, vi } from 'vitest'

const addDoc = vi.fn()
vi.mock('firebase/firestore', () => ({
  addDoc: (...args) => addDoc(...args),
  collection: (_, ...parts) => parts.join('/'),
  doc: vi.fn(),
  getDocFromServer: vi.fn(),
  serverTimestamp: () => 'server-time',
}))

const { applicationReference, submitPublicApplication, validateApplicationContact } = await import('./publicApplications.js')

const valid = {
  fullName: 'Valentina Demo', birthDate: '2000-02-15', city: 'Lima', email: 'vale@example.test',
  graduationYear: '2027', academy: '', message: '', consentAccepted: true,
}

describe('validateApplicationContact (PCIT-183)', () => {
  it('acepta datos de contacto válidos', () => {
    expect(validateApplicationContact(valid)).toEqual({})
  })

  it('marca cada campo inválido por separado', () => {
    const errors = validateApplicationContact({ ...valid, city: 'L', email: 'sin-arroba', graduationYear: '27', message: 'x'.repeat(1001) })
    expect(Object.keys(errors).sort()).toEqual(['city', 'email', 'graduationYear', 'message'])
    expect(validateApplicationContact({ ...valid, graduationYear: '1800' })).toHaveProperty('graduationYear')
    expect(validateApplicationContact({ ...valid, email: undefined })).toHaveProperty('email')
  })
})

describe('submitPublicApplication', () => {
  beforeEach(() => addDoc.mockReset())

  it('junta los errores del jugador y los de contacto, sin escribir nada', () => {
    let failure
    try {
      submitPublicApplication({}, { orgId: 'org-demo', formId: 'f1' }, { ...valid, fullName: '', email: 'malo' })
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({ code: 'applications/validation' })
    expect(failure.fields).toHaveProperty('fullName')
    expect(failure.fields).toHaveProperty('email')
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('guarda una postulación válida', async () => {
    addDoc.mockResolvedValueOnce({ id: 'app-1' })
    await submitPublicApplication({}, { orgId: 'org-demo', formId: 'f1' }, valid)
    expect(addDoc).toHaveBeenCalledWith('applications', expect.objectContaining({ city: 'Lima', email: 'vale@example.test', graduationYear: 2027 }))
  })
})

describe('applicationReference (PCIT-186)', () => {
  it('arma un número corto y estable a partir del ID', () => {
    expect(applicationReference('k3J9xQ7pLm2Ab4Cd5Ef6')).toBe('AC-K3J9XQ')
    expect(applicationReference('k3J9xQ7pLm2Ab4Cd5Ef6')).toBe(applicationReference('k3J9xQ7pLm2Ab4Cd5Ef6'))
    expect(applicationReference('')).toBe('')
    expect(applicationReference(undefined)).toBe('')
  })
})
