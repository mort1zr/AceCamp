import { describe, expect, it } from 'vitest'
import { PESO_METRICAS, posicionRanking, valoracionJugador } from './valoracion.js'

describe('valoracionJugador', () => {
  it('convierte las métricas reales en atributos de 30 a 99 y su media', () => {
    const { media, atributos } = valoracionJugador(
      { utr: 16.5 },
      {
        analyzedMatches: 10,
        averageServeSpeed: 180,
        firstServeInRate: 70,
        averageShotSpeed: 120,
        doubleFaults: 0,
        distanceMeters: 25000,
      },
    )
    expect(atributos.map((atributo) => atributo.valor)).toEqual([99, 99, 99, 99])
    expect(media).toBe(99)
  })

  it('deja sin valor lo que no se midió y no lo cuenta en la media', () => {
    const { media, atributos } = valoracionJugador({ utr: null }, { averageServeSpeed: 145 })
    expect(atributos.find((atributo) => atributo.clave === 'SER').valor).toBe(70)
    expect(atributos.filter((atributo) => atributo.valor == null)).toHaveLength(3)
    expect(media).toBe(70)
  })

  it('sin métricas no inventa una valoración', () => {
    expect(valoracionJugador({}, undefined).media).toBeNull()
  })

  it('mezcla 86 % de métricas con 14 % del UTR', () => {
    expect(PESO_METRICAS).toBe(0.86)
    const metricas = { averageServeSpeed: 145 }
    expect(valoracionJugador({ utr: null }, metricas).media).toBe(70)
    const nivel = valoracionJugador({ utr: 16.5 }, metricas).nivel
    expect(nivel).toBe(99)
    expect(valoracionJugador({ utr: 16.5 }, metricas).media).toBe(
      Math.round(69.5 * 0.86 + 99 * 0.14),
    )
  })

  it('el UTR solo no basta para tener valoración', () => {
    expect(valoracionJugador({ utr: 16 }, {}).media).toBeNull()
  })
})

describe('posicionRanking', () => {
  const jugadores = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }]
  const metricas = {
    a: { averageServeSpeed: 170 },
    b: { averageServeSpeed: 150 },
    c: { averageServeSpeed: 150 },
    d: {},
  }

  it('ordena por valoración y comparte puesto en los empates', () => {
    expect(posicionRanking(jugadores, metricas, 'a')).toBe(1)
    expect(posicionRanking(jugadores, metricas, 'b')).toBe(2)
    expect(posicionRanking(jugadores, metricas, 'c')).toBe(2)
  })

  it('no clasifica a quien no tiene valoración', () => {
    expect(posicionRanking(jugadores, metricas, 'd')).toBeNull()
    expect(posicionRanking(jugadores, metricas, 'e')).toBeNull()
  })
})
