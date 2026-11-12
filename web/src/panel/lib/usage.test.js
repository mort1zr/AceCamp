import { describe, expect, it } from 'vitest'
import { nextUsage, planLimit, quotaLow, quotaReached, remainingAnalyses, usagePeriod } from './usage.js'
import { analysisErrorMessage } from './analysis.js'

describe('límite del plan', () => {
  it('usa los mismos valores que las reglas', () => {
    expect([planLimit('free'), planLimit('prueba'), planLimit('basico'), planLimit('pro'), planLimit('ultra')]).toEqual([0, 15, 30, 150, 500])
    expect(planLimit('inventado')).toBe(0)
    expect(planLimit(undefined)).toBe(0)
  })

  it('cuenta los que quedan y avisa en el último 20 % del plan', () => {
    expect(remainingAnalyses(12, 15)).toBe(3)
    expect(remainingAnalyses(20, 15)).toBe(0)
    expect(remainingAnalyses(900, null)).toBeNull()
    expect([quotaLow(11, 15), quotaLow(12, 15), quotaLow(15, 15)]).toEqual([false, true, false])
    expect([quotaLow(119, 150), quotaLow(120, 150)]).toEqual([false, true])
    expect(quotaLow(900, null)).toBe(false)
  })

  it('se alcanza al llegar al tope; Ultra nunca', () => {
    expect(quotaReached(14, 15)).toBe(false)
    expect(quotaReached(15, 15)).toBe(true)
    expect(quotaReached(null, 0)).toBe(true)
    expect(quotaReached(5000, null)).toBe(false)
  })

  it('explica el límite con un mensaje para el usuario', () => {
    expect(analysisErrorMessage({ code: 'analysis/limit', limit: 30 })).toContain('los 30 análisis de su plan este mes')
    expect(analysisErrorMessage({ code: 'analysis/limit', limit: 0 })).toContain('Elige un plan en Configuración')
  })
})

describe('usagePeriod', () => {
  it('usa el mes en UTC, como las reglas', () => {
    expect(usagePeriod(new Date('2026-11-05T15:00:00Z'))).toBe('2026-11')
    expect(usagePeriod(new Date('2026-03-01T00:00:00Z'))).toBe('2026-03')
    // 31 de octubre a las 21:00 en Lima ya es noviembre en UTC.
    expect(usagePeriod(new Date('2026-11-01T02:00:00Z'))).toBe('2026-11')
  })
})

describe('nextUsage', () => {
  it('empieza en uno y luego suma de a uno', () => {
    expect(nextUsage(null, 'm1', 'ahora')).toEqual({ analyses: 1, lastMatchId: 'm1', updatedAt: 'ahora' })
    expect(nextUsage({ analyses: 7, lastMatchId: 'm0' }, 'm8', 'ahora')).toEqual({ analyses: 8, lastMatchId: 'm8', updatedAt: 'ahora' })
  })
})
