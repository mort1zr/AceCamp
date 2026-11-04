import { describe, expect, it } from 'vitest'
import { validateAnalysis, validateVideoFile, validateVideoUrl } from './analysis.js'

const file = { name: 'partido.mp4', type: 'video/mp4', size: 100, lastModified: 10 }
const input = { sourceType: 'file', file, playerId: 'player-a', playerPosition: 'arriba', opponent: 'Rival', matchDate: '2026-01-01' }

describe('Validación de análisis', () => {
  it('rechaza archivos vacíos, demasiado grandes y formatos distintos', () => {
    expect(validateVideoFile(file, 100)).toBeNull()
    expect(validateVideoFile({ ...file, size: 101 }, 100)).toContain('supera')
    expect(validateVideoFile({ ...file, size: 0 }, 100)).toContain('vacío')
    expect(validateVideoFile({ ...file, type: 'text/plain' }, 100)).toContain('MP4 o MOV')
    expect(validateVideoFile({ ...file, name: 'partido.exe' }, 100)).toContain('MP4 o MOV')
    expect(validateVideoFile({ ...file, name: 'PARTIDO.MOV', type: '' }, 100)).toBeNull()
  })

  it('admite enlaces directos HTTPS y rechaza credenciales, fragmentos y otros protocolos', () => {
    expect(validateVideoUrl('https://ejemplo.com/partido.MP4?download=1')).toBeNull()
    for (const url of ['http://ejemplo.com/video.mp4', 'javascript:alert(1)', 'https://user:password@ejemplo.com/video.mp4', 'https://ejemplo.com/video.mp4#token', 'https://ejemplo.com/pagina', 'no-es-url']) expect(validateVideoUrl(url)).toBeTruthy()
  })

  it('exige jugador, posición, rival, fecha y capacidad de importación', () => {
    expect(validateAnalysis(input, { maxBytes: 100 })).toEqual({})
    expect(validateAnalysis({ ...input, playerId: '', playerPosition: '', opponent: '', matchDate: '2099-01-01' }, { maxBytes: 100 })).toMatchObject({ playerId: expect.any(String), playerPosition: expect.any(String), opponent: expect.any(String), matchDate: expect.any(String) })
    expect(validateAnalysis({ ...input, sourceType: 'link', url: 'https://ejemplo.com/video.mp4' }, { maxBytes: 100 }).url).toContain('aún no está disponible')
  })
})
