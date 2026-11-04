import { beforeEach, describe, expect, it, vi } from 'vitest'

// Tarea de subida simulada: las pruebas deciden cuándo avanza, falla o termina.
const upload = vi.hoisted(() => ({ calls: [], task: null }))

vi.mock('firebase/storage', () => ({
  ref: (storage, path) => ({ storage, path }),
  uploadBytesResumable: (reference, file, metadata) => {
    const handlers = {}
    upload.task = {
      on: (event, next, error, complete) => Object.assign(handlers, { next, error, complete }),
      cancel: vi.fn(() => handlers.error({ code: 'storage/canceled' })),
      progress: (bytesTransferred, totalBytes) => handlers.next({ bytesTransferred, totalBytes }),
      fail: error => handlers.error(error),
      finish: () => handlers.complete(),
    }
    upload.calls.push({ path: reference.path, file, metadata })
    return upload.task
  },
}))

const { MAX_VIDEO_BYTES, checkVideoFile, createVideoUploadService, videoErrorMessage, videoExtension } = await import('./videoUpload.js')

const video = (name, size = 1024, type = '') => ({ name, size, type })
const identity = { orgId: 'org-demo', actorId: 'coach-demo', matchId: 'm-1' }
const { uploadVideo } = createVideoUploadService({ storage: 'fake-storage' })

beforeEach(() => {
  upload.calls = []
  upload.task = null
})

describe('validación del archivo', () => {
  it('reconoce .mp4 y .mov por nombre o tipo', () => {
    expect(videoExtension(video('Final.MP4'))).toBe('mp4')
    expect(videoExtension(video('saque.mov'))).toBe('mov')
    expect(videoExtension(video('sin-extension', 1, 'video/quicktime'))).toBe('mov')
    expect(videoExtension(video('partido.avi', 1, 'video/x-msvideo'))).toBeNull()
  })

  it('rechaza formatos, archivos vacíos y videos demasiado grandes', () => {
    expect(() => checkVideoFile(video('partido.avi'))).toThrow('.mp4 o .mov')
    expect(() => checkVideoFile(video('partido.mp4', 0))).toThrow('vacío')
    expect(() => checkVideoFile(video('partido.mp4', 101), 100)).toThrow('supera el máximo')
    // maxBytes no puede pasar el límite de las reglas.
    expect(() => checkVideoFile(video('partido.mp4', MAX_VIDEO_BYTES + 1), MAX_VIDEO_BYTES * 8)).toThrow('500 MB')
  })
})

describe('uploadVideo', () => {
  it('sube a la ruta del partido con tipo y autor, informa el avance y devuelve la ruta', async () => {
    const onProgress = vi.fn()
    const result = uploadVideo({ ...identity, file: video('Final.mov'), onProgress })
    expect(upload.calls[0].path).toBe('orgs/org-demo/matches/m-1/video.mov')
    expect(upload.calls[0].metadata).toEqual({ contentType: 'video/quicktime', customMetadata: { uploadedBy: 'coach-demo' } })
    upload.task.progress(512, 1024)
    upload.task.finish()
    await expect(result).resolves.toBe('orgs/org-demo/matches/m-1/video.mov')
    expect(onProgress.mock.calls.map(([percent]) => percent)).toEqual([0, 50, 100])
  })

  it('cancela con AbortSignal', async () => {
    const controller = new AbortController()
    const result = uploadVideo({ ...identity, file: video('Final.mp4'), signal: controller.signal })
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
    expect(upload.task.cancel).toHaveBeenCalledTimes(1)
  })

  it('no empieza si ya está cancelado o el archivo no es válido', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(uploadVideo({ ...identity, file: video('Final.mp4'), signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
    await expect(uploadVideo({ ...identity, file: video('Final.avi') })).rejects.toMatchObject({ code: 'video/invalid-type' })
    await expect(uploadVideo({ ...identity, orgId: '', file: video('Final.mp4') })).rejects.toMatchObject({ code: 'video/missing-identity' })
    expect(upload.calls).toHaveLength(0)
  })

  it('propaga el error de Storage con un mensaje apto para el usuario', async () => {
    const result = uploadVideo({ ...identity, file: video('Final.mp4') })
    upload.task.fail({ code: 'storage/unauthorized' })
    const error = await result.catch(caught => caught)
    expect(videoErrorMessage(error)).toBe('No tienes permiso para subir videos a esta organización.')
    expect(videoErrorMessage(new Error('boom'))).toBe('No pudimos subir el video. Inténtalo de nuevo.')
  })
})
