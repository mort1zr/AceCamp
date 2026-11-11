import { describe, expect, it } from 'vitest'
import { deploySummary } from './deploySummary.mjs'

const produccion = {
  EVENT_NAME: 'push', PRODUCTION_URL: 'https://acecam-e93a2.web.app/', VERSION: '0123456789abcdef0123',
  HOSTING_OUTCOME: 'success', CHECK_OUTCOME: 'success', RULES_OUTCOME: 'success', DEPLOY_STORAGE_RULES: '',
}

describe('resumen del despliegue (PCIT-200)', () => {
  it('producción: URL, versión corta, cada paso y Storage omitido', () => {
    const texto = deploySummary(produccion)
    expect(texto).toContain('| Destino | Producción (`main`) |')
    expect(texto).toContain('[https://acecam-e93a2.web.app/](https://acecam-e93a2.web.app/)')
    expect(texto).toContain('| Versión (commit) | `0123456789ab` |')
    expect(texto).toContain('| Comprobación de la web en vivo | ✅ Bien |')
    expect(texto).toContain('| Reglas de Storage | ⏭️ Omitidas')
  })

  it('muestra qué paso falló y los que no llegaron a correr', () => {
    const texto = deploySummary({ ...produccion, CHECK_OUTCOME: 'failure', RULES_OUTCOME: 'skipped' })
    expect(texto).toContain('| Comprobación de la web en vivo | ❌ Falló |')
    expect(texto).toContain('| Reglas e índices de Firestore | ⏭️ No se ejecutó |')
  })

  it('vista previa de una PR: su URL y sin pasos de producción', () => {
    const texto = deploySummary({ EVENT_NAME: 'pull_request', PREVIEW_URL: 'https://acecam-e93a2--pr30-x.web.app', VERSION: 'abc', HOSTING_OUTCOME: 'success' })
    expect(texto).toContain('Vista previa de la PR')
    expect(texto).toContain('https://acecam-e93a2--pr30-x.web.app')
    expect(texto).not.toContain('Reglas')
  })

  it('con Storage activado muestra su resultado real', () => {
    expect(deploySummary({ ...produccion, DEPLOY_STORAGE_RULES: 'true' })).toContain('| Reglas de Storage | ✅ Bien |')
  })
})
