import { describe, expect, it } from 'vitest'
import { parseVideoSource, parseYouTubeUrl } from './videoSources.js'
import { validateAnalysis, validateVideoUrl } from './analysis.js'

const id = 'abcdefghijk'
const canonical = `https://www.youtube.com/watch?v=${id}`

describe('Identidad de un video de YouTube', () => {
  it('normaliza watch, enlace compartido, shorts, embed y archivo de live a un solo ID', () => {
    for (const url of [canonical, `https://youtube.com/watch?v=${id}&list=ignored&t=25`, `https://youtu.be/${id}?si=tracking`, `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}`]) expect(parseYouTubeUrl(url)).toEqual({ provider: 'youtube', videoId: id, url: canonical })
  })

  it('rechaza playlists sin video, canales, hosts parecidos, credenciales y IDs ambiguos', () => {
    for (const url of ['https://www.youtube.com/playlist?list=PL123', 'https://www.youtube.com/@channel', `https://youtu.be/${id}/extra`, 'https://www.youtube.com/watch?v=short', `https://www.youtube.com/watch?v=${id}&v=ABCDEFGHIJK`, `https://www.youtube.com.attacker.example/watch?v=${id}`, `https://youtu.be.attacker.example/${id}`, `https://u:p@youtube.com/watch?v=${id}`, `http://youtube.com/watch?v=${id}`, `https://youtube.com:8443/watch?v=${id}`, `${canonical}#fragment`]) expect(parseYouTubeUrl(url), url).toBeNull()
  })

  it('exige capacidad explícita y conserva la compatibilidad con enlaces directos', () => {
    expect(parseVideoSource(canonical)).toBeNull()
    expect(validateVideoUrl(canonical)).toContain('aún no está disponible')
    expect(validateVideoUrl(canonical, { supportsYouTube: true })).toBeNull()
    expect(parseVideoSource('https://media.example/video.MOV?signature=abc')).toEqual({ provider: 'direct', url: 'https://media.example/video.MOV?signature=abc' })
    const input = { sourceType: 'link', url: canonical, playerId: 'p1', playerPosition: 'arriba', opponent: 'Rival', matchDate: '2026-01-01' }
    expect(validateAnalysis(input, { supportsLinks: true })).toHaveProperty('url')
    expect(validateAnalysis(input, { supportsLinks: true, supportsYouTube: true })).toEqual({})
  })
})
