import { expect, it, vi } from 'vitest'
import { getBlob, ref } from 'firebase/storage'
import { createProcessedVideoService } from './processedVideoService.js'

vi.mock('firebase/storage', () => ({ getBlob: vi.fn(), ref: vi.fn((_, path) => path) }))

it('lee por SDK autenticado y rechaza referencias fuera del partido y organización', async () => {
  const storage = {}
  const blob = new Blob(['video'], { type: 'video/mp4' })
  getBlob.mockResolvedValue(blob)
  const service = createProcessedVideoService({ storage, orgId: 'org-a' })
  expect(await service.load({ matchId: 'm1', path: 'orgs/org-a/matches/m1/processed.mp4' })).toBe(blob)
  expect(ref).toHaveBeenCalledWith(storage, 'orgs/org-a/matches/m1/processed.mp4')
  for (const path of ['https://example.com/video.mp4', 'orgs/org-b/matches/m1/processed.mp4', 'orgs/org-a/matches/m2/processed.mp4']) {
    await expect(service.load({ matchId: 'm1', path })).rejects.toThrow()
  }
  expect(getBlob).toHaveBeenCalledTimes(1)
})
