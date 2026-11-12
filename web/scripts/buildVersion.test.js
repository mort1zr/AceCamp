import { describe, expect, it } from 'vitest'
import { buildVersion, readVersion, versionPlugin } from './buildVersion.mjs'

describe('versión del build (PCIT-198)', () => {
  it('usa el commit de la CI y "local" fuera de ella', () => {
    expect(buildVersion({ ACECAM_VERSION: 'abc123def456' })).toBe('abc123def456')
    expect(buildVersion({ GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567' })).toBe('0123456789abcdef0123456789abcdef01234567')
    expect(buildVersion({ ACECAM_VERSION: 'v1', GITHUB_SHA: 'otro' })).toBe('v1')
    expect(buildVersion({})).toBe('local')
  })

  it('no deja pasar texto que rompa el HTML', () => {
    expect(buildVersion({ ACECAM_VERSION: '"><script>alert(1)</script>' })).toBe('local')
    expect(buildVersion({ ACECAM_VERSION: 'x'.repeat(65) })).toBe('local')
  })

  it('el plugin agrega la etiqueta meta y se puede leer de vuelta', () => {
    const [tag] = versionPlugin('abc123').transformIndexHtml()
    expect(tag).toEqual({ tag: 'meta', attrs: { name: 'acecam-version', content: 'abc123' }, injectTo: 'head' })
    expect(readVersion('<head><meta name="acecam-version" content="abc123"></head>')).toBe('abc123')
    expect(readVersion('<head><title>AceCam</title></head>')).toBeNull()
  })
})
