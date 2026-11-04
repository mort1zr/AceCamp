import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { createLocalVideoProbe, readVideoMetadata } from './probe.js'

const report = (override = {}) => JSON.stringify({ format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '25.5', tags: { major_brand: 'isom' } }, streams: [{ codec_type: 'video', width: 1920, height: 1080, disposition: { attached_pic: 0 } }], ...override })

describe('Verificación de contenedor y pista de video', () => {
  it('acepta MP4/MOV con duración y dimensiones reales, y rechaza audio o imágenes adjuntas', () => {
    expect(readVideoMetadata(report())).toEqual({ durationSeconds: 25.5, width: 1920, height: 1080, extension: 'mp4', contentType: 'video/mp4' })
    for (const output of [report({ streams: [{ codec_type: 'audio' }] }), report({ streams: [{ codec_type: 'video', width: 100, height: 100, disposition: { attached_pic: 1 } }] }), report({ format: { format_name: 'matroska', duration: '10' } }), report({ format: { format_name: 'mov,mp4', duration: 'NaN' } }), '<html>not video</html>']) expect(() => readVideoMetadata(output)).toThrow()
  })

  it('distingue MOV, MP4 y marcas de otros formatos de la misma familia', () => {
    expect(readVideoMetadata(report({ format: { format_name: 'mov,mp4', duration: '10', tags: { major_brand: 'qt  ' } } }))).toMatchObject({ extension: 'mov', contentType: 'video/quicktime' })
    expect(() => readVideoMetadata(report({ format: { format_name: 'mov,mp4,3gp', duration: '10', tags: { major_brand: '3gp6' } } }))).toThrow()
  })

  it('ejecuta solo el binario configurado, sin shell ni protocolos de red', async () => {
    const execute = vi.fn(async () => ({ stdout: report() }))
    const executable = resolve('tools', 'ffprobe')
    const probe = createLocalVideoProbe({ executable, execute })
    await probe({ localPath: resolve('temporary', 'video') })
    const [file, args, options] = execute.mock.calls[0]
    expect(file).toBe(executable)
    expect(args).toEqual(expect.arrayContaining(['-protocol_whitelist', 'file', '-format_whitelist', 'mov']))
    expect(options).toMatchObject({ timeout: 15_000, maxBuffer: 65536, windowsHide: true })
    expect(options.shell).toBeUndefined()
    expect(() => createLocalVideoProbe({ executable: 'ffprobe' })).toThrow()
  })

  it('no filtra stderr/rutas y propaga cancelación', async () => {
    const execute = vi.fn(async () => { throw new Error('private path or ffprobe stderr') })
    const probe = createLocalVideoProbe({ executable: resolve('ffprobe'), execute })
    await expect(probe({ localPath: resolve('video') })).rejects.toMatchObject({ code: 'import/format', message: expect.not.stringContaining('private') })
    const controller = new AbortController()
    controller.abort()
    await expect(probe({ localPath: 'video', signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
