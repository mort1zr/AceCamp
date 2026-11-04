import { describe, expect, it } from 'vitest'
import { authErrorMessage, validateLogin, validateRegistration } from './auth.js'

const valid = {
  name: 'Coach Ramírez', orgName: 'Universidad Demo', email: 'coach@acecam.test',
  password: 'acecam123', confirmPassword: 'acecam123',
}

describe('validateRegistration', () => {
  it('acepta un formulario completo', () => {
    expect(validateRegistration(valid)).toEqual({})
  })

  it('avisa cuando las contraseñas no coinciden', () => {
    expect(validateRegistration({ ...valid, confirmPassword: 'otra-clave' })).toEqual({
      confirmPassword: 'Las contraseñas no coinciden.',
    })
  })

  it('pide nombre, organización, correo válido y contraseña de 6 caracteres', () => {
    const errors = validateRegistration({ name: ' ', orgName: 'A', email: 'no-es-correo', password: '123', confirmPassword: '123' })
    expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'orgName', 'password'])
    expect(errors.password).toContain('6 caracteres')
  })
})

describe('validateLogin', () => {
  it('pide correo y contraseña', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Escribe tu correo.', password: 'Escribe tu contraseña.',
    })
    expect(validateLogin({ email: ' Coach@AceCam.test ', password: 'x' })).toEqual({})
  })
})

describe('authErrorMessage', () => {
  it('traduce los errores de Firebase que ve el usuario', () => {
    expect(authErrorMessage({ code: 'auth/invalid-credential' })).toBe('Correo o contraseña incorrectos.')
    expect(authErrorMessage({ code: 'auth/user-not-found' })).toBe('No existe una cuenta con ese correo.')
    expect(authErrorMessage({ code: 'auth/email-already-in-use' })).toContain('Ya existe una cuenta')
    expect(authErrorMessage({ code: 'auth/too-many-requests' })).toContain('Demasiados intentos')
  })

  it('no muestra errores técnicos desconocidos', () => {
    expect(authErrorMessage(new Error('INTERNAL ASSERTION FAILED'))).toBe('Algo salió mal. Inténtalo de nuevo.')
  })
})
