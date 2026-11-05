import { describe, expect, it } from 'vitest'
import { nextUsage, usagePeriod } from './usage.js'

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
