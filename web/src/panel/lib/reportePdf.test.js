import { describe, expect, it } from 'vitest'
import { iniciales, nombreArchivo, setsDelMarcador } from './reportePdf.js'

describe('reportePdf', () => {
  it('lee los sets del marcador con tie-break', () => {
    expect(setsDelMarcador('6-4 3-6 7-6(5)')).toEqual([
      { propios: 6, rival: 4, tiebreak: undefined },
      { propios: 3, rival: 6, tiebreak: undefined },
      { propios: 7, rival: 6, tiebreak: '5' },
    ])
  })

  it('ignora marcadores vacíos o con texto libre', () => {
    expect(setsDelMarcador(undefined)).toEqual([])
    expect(setsDelMarcador('ganó por retiro')).toEqual([])
  })

  it('arma un nombre de archivo sin caracteres prohibidos', () => {
    expect(nombreArchivo('Partido', 'Ana', 'vs J/K', '')).toBe('AceCam - Partido - Ana - vs JK')
  })

  it('toma dos iniciales', () => {
    expect(iniciales('Mateo Rojas Díaz')).toBe('MR')
  })
})
