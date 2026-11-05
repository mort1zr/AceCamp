import { describe, expect, it } from 'vitest'
import {
  formatearNumero,
  formatearVencimiento,
  marcaTarjeta,
  pasaLuhn,
  validarTarjeta,
} from './tarjeta.js'

const ahora = new Date(2026, 10, 4)

describe('tarjeta', () => {
  it('formatea el número en grupos de cuatro', () => {
    expect(formatearNumero('4242424242424242')).toBe('4242 4242 4242 4242')
    expect(formatearNumero('42a42')).toBe('4242')
  })

  it('formatea el vencimiento como MM/AA', () => {
    expect(formatearVencimiento('1228')).toBe('12/28')
    expect(formatearVencimiento('1')).toBe('1')
  })

  it('reconoce números válidos y la marca', () => {
    expect(pasaLuhn('4242 4242 4242 4242')).toBe(true)
    expect(pasaLuhn('4242 4242 4242 4241')).toBe(false)
    expect(marcaTarjeta('4242')).toBe('visa')
    expect(marcaTarjeta('5555')).toBe('mastercard')
    expect(marcaTarjeta('3782')).toBe('amex')
  })

  it('acepta una tarjeta completa y válida', () => {
    const datos = {
      nombre: 'Coach Ramírez',
      numero: '4242 4242 4242 4242',
      vencimiento: '12/28',
      cvc: '123',
    }
    expect(validarTarjeta(datos, ahora)).toEqual({})
  })

  it('marca cada campo con error', () => {
    const datos = { nombre: '', numero: '1234', vencimiento: '10/26', cvc: '12' }
    expect(Object.keys(validarTarjeta(datos, ahora)).sort()).toEqual([
      'cvc',
      'nombre',
      'numero',
      'vencimiento',
    ])
  })
})
