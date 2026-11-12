import { expect, it } from 'vitest'
import { resultadoDelPartido } from './partido.js'

it('reconoce si el jugador ganó o perdió solo con marcadores completos', () => {
  expect(resultadoDelPartido('6-4 3-6 7-5')).toBe('gano')
  expect(resultadoDelPartido('4-6 6-7(4)')).toBe('perdio')
  expect(resultadoDelPartido('7-6(5) 6-4')).toBe('gano')
})

it('no adivina cuando el marcador está incompleto, empatado o vacío', () => {
  expect(resultadoDelPartido('6-4 3-2')).toBeNull()
  expect(resultadoDelPartido('6-4 4-6')).toBeNull()
  expect(resultadoDelPartido('')).toBeNull()
  expect(resultadoDelPartido(undefined)).toBeNull()
  expect(resultadoDelPartido('ganó fácil')).toBeNull()
})
